import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiLlmClient } from './ai-llm.client';
import { AiPromptsRepository } from './ai-prompts.repository';
import { AiSummarizeRateLimitService } from './ai-summarize-rate-limit.service';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import {
  SummarizeContext,
  SummarizeRequest,
  SummarizeResponse,
  SUMMARIZE_MAX_TEXT_LENGTH,
} from './summarize.types';

@Injectable()
export class AiSummarizeService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly llm: AiLlmClient,
    private readonly prompts: AiPromptsRepository,
    private readonly rateLimit: AiSummarizeRateLimitService,
    private readonly timeline: CustomerTimelineService,
    private readonly leadContext: LeadScoreContextRepository,
  ) {}

  async summarize(input: SummarizeRequest): Promise<SummarizeResponse> {
    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const context = this.resolveContext(input);
    const actorKey = input.actorId?.trim() || 'anonymous';
    this.rateLimit.check(actorKey, this.aiConfig.summarizeRateLimitPerMin);

    const entityType = input.entityType?.trim() || null;
    const entityId = input.entityId?.trim() || null;
    const text = input.text?.trim() ?? '';

    if (context === 'activity') {
      this.assertActivityText(text);
    }

    if (context === 'lead_brief') {
      if (!entityType || !entityId) {
        throw new BadRequestException({
          error: 'entity_required',
          message: 'lead_brief requires entity_type and entity_id',
        });
      }
      if (entityType !== 'lead') {
        throw new BadRequestException({
          error: 'unsupported_entity',
          message: 'lead_brief only supports entity_type=lead',
        });
      }
    }

    const useCase = context === 'lead_brief' ? AI_USE_CASE.LEAD_BRIEF : AI_USE_CASE.SUMMARIZE;
    const userContent = await this.buildUserContent(context, {
      text,
      entityType,
      entityId,
    });
    const prompt = await this.prompts.getActivePrompt(useCase);

    const wrapped = await this.audit.wrap(
      {
        useCase,
        entityType: entityType ?? undefined,
        entityId: entityId ?? undefined,
        clientId: input.clientId ?? null,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName: this.aiConfig.llmModel,
        input: {
          context,
          text_chars: text.length,
          entity_type: entityType,
          entity_id: entityId,
          prompt_source: prompt.source,
          prompt_version: prompt.version,
        },
      },
      async () => {
        const result = await this.llm.summarizeStructured({
          context,
          systemPrompt: prompt.promptTemplate,
          userContent,
          model: this.aiConfig.llmModel,
        });
        return {
          data: result.parsed,
          output: {
            summary_len: result.parsed.summary.length,
            bullets: result.parsed.bullets.length,
            confidence: result.parsed.confidence,
            stub_mode: result.stubMode,
          },
          modelName: result.modelName,
          tokenUsage: result.tokenUsage,
        };
      },
    );

    return {
      data: {
        context,
        entity_type: entityType,
        entity_id: entityId,
        summary: wrapped.data.summary,
        bullets: wrapped.data.bullets,
        extracted: wrapped.data.extracted,
        confidence: wrapped.data.confidence,
        agent_run_id: wrapped.runId,
        model: this.aiConfig.llmModel,
        stub_mode: !this.aiConfig.llmApiKey,
      },
      meta: { request_id: requestId, latency_ms: wrapped.latencyMs },
      errors: [],
    };
  }

  private resolveContext(input: SummarizeRequest): SummarizeContext {
    const raw = String(input.context ?? 'activity').trim().toLowerCase();
    if (raw === 'lead_brief' || raw === 'brief') return 'lead_brief';
    if (raw === 'activity' || raw === 'summarize_activity') return 'activity';
    throw new BadRequestException({
      error: 'invalid_context',
      message: 'context must be lead_brief or activity',
    });
  }

  private assertActivityText(text: string): void {
    const min = this.aiConfig.summarizeMinTextLength;
    if (!text) {
      throw new BadRequestException({ error: 'text_required', message: 'text is required for activity summarize' });
    }
    if (text.length < min) {
      throw new BadRequestException({
        error: 'text_too_short',
        message: `text must be at least ${min} characters`,
        min_length: min,
      });
    }
    if (text.length > SUMMARIZE_MAX_TEXT_LENGTH) {
      throw new BadRequestException({
        error: 'text_too_long',
        message: `text must be at most ${SUMMARIZE_MAX_TEXT_LENGTH} characters`,
      });
    }
  }

  private async buildUserContent(
    context: SummarizeContext,
    args: { text: string; entityType: string | null; entityId: string | null },
  ): Promise<string> {
    if (context === 'activity') {
      const timelineBlock =
        args.entityType && args.entityId
          ? await this.formatTimelineContext(args.entityType, args.entityId, 8)
          : '';
      return ['TEXT:', args.text, timelineBlock ? '\nTIMELINE:\n' + timelineBlock : ''].join('\n').trim();
    }

    const leadId = Number(args.entityId);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      throw new BadRequestException({ error: 'invalid_entity_id', entity_id: args.entityId });
    }

    const ctx = await this.leadContext.loadLeadScoreContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
    }

    const timelineBlock = await this.formatTimelineContext('lead', String(leadId), 15);
    const campaignParts = [
      ctx.campaignId ? `campaign_id=${ctx.campaignId}` : '',
      ctx.campaignName ? `campaign_name=${ctx.campaignName}` : '',
      ctx.cplVnd != null ? `cpl_vnd=${ctx.cplVnd}` : '',
      ctx.targetCplVnd != null ? `target_cpl_vnd=${ctx.targetCplVnd}` : '',
      ctx.cplOverTarget ? 'cpl_status=over_target' : ctx.cplVnd != null ? 'cpl_status=on_target' : '',
    ].filter(Boolean);
    const lines = [
      `LEAD_ID: ${leadId}`,
      `NAME_CHANNEL: ${ctx.channel ?? 'unknown'} / ${ctx.source ?? 'unknown'}`,
      campaignParts.length ? `CAMPAIGN_CPL: ${campaignParts.join(' · ')}` : '',
      `STATUS: ${ctx.status ?? 'new'}`,
      `EXTERNAL: ${ctx.externalLeadId ?? 'n/a'}`,
      `DUPLICATE: ${ctx.isDuplicate ? 'yes' : 'no'}`,
      `TIMELINE_EVENTS: ${ctx.timelineEventCount}`,
      args.text ? `NOTES:\n${args.text.slice(0, 2000)}` : '',
      timelineBlock ? `TIMELINE:\n${timelineBlock}` : 'TIMELINE: (trống — chưa có tương tác)',
    ];
    return lines.filter(Boolean).join('\n');
  }

  private async formatTimelineContext(
    entityType: string,
    entityId: string,
    limit: number,
  ): Promise<string> {
    const items = await this.timeline.buildAiContext(entityType, entityId, limit);
    if (!items.length) return '';
    return items
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.event_source}/${item.event_type}] ${item.title}${item.summary ? ': ' + item.summary : ''}`,
      )
      .join('\n');
  }
}
