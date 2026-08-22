import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiLlmClient } from './ai-llm.client';
import { AiPromptsRepository } from './ai-prompts.repository';
import { AiNbaService } from './ai-nba.service';
import { AiLeadRouteService } from './ai-lead-route.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiSummarizeRateLimitService } from './ai-summarize-rate-limit.service';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import {
  CHANNEL_LABELS,
  CreateRecommendationRequest,
  FOLLOW_UP_CHANNELS,
  FollowUpChannelHint,
  PatchRecommendationRequest,
  RecommendationListResponse,
  RecommendationResponse,
  RecommendationStatus,
} from './recommendation.types';

@Injectable()
export class AiRecommendationService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly llm: AiLlmClient,
    private readonly prompts: AiPromptsRepository,
    private readonly rateLimit: AiSummarizeRateLimitService,
    private readonly timeline: CustomerTimelineService,
    private readonly leadContext: LeadScoreContextRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly nba: AiNbaService,
    private readonly leadRoute: AiLeadRouteService,
    private readonly crmLegacy: CrmLeadsLegacyService,
  ) {}

  async createFollowUpDraft(input: CreateRecommendationRequest): Promise<RecommendationResponse> {
    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const actorKey = input.actorId?.trim() || 'anonymous';
    this.rateLimit.check(actorKey, this.aiConfig.summarizeRateLimitPerMin);

    const type = String(input.type ?? '').trim();
    if (type !== 'follow_up_draft') {
      throw new BadRequestException({
        error: 'invalid_type',
        message: 'type must be follow_up_draft',
      });
    }

    const entityType = input.entityType?.trim();
    const entityId = input.entityId?.trim();
    if (!entityType || !entityId) {
      throw new BadRequestException({
        error: 'entity_required',
        message: 'entity_type and entity_id are required',
      });
    }
    if (entityType !== 'lead') {
      throw new BadRequestException({
        error: 'unsupported_entity',
        message: 'follow_up_draft only supports entity_type=lead',
      });
    }

    const channelHint = this.resolveChannel(input.channelHint);
    await this.assertRecommendationsReady();

    const leadId = Number(entityId);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      throw new BadRequestException({ error: 'invalid_entity_id', entity_id: entityId });
    }

    const ctx = await this.leadContext.loadLeadScoreContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
    }

    const userContent = await this.buildFollowUpUserContent(leadId, ctx, input.contextText);
    const prompt = await this.prompts.getActivePrompt(AI_USE_CASE.FOLLOW_UP_DRAFT);

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.FOLLOW_UP_DRAFT,
        entityType,
        entityId,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName: this.aiConfig.llmModel,
        input: {
          channel_hint: channelHint,
          entity_type: entityType,
          entity_id: entityId,
          prompt_source: prompt.source,
          prompt_version: prompt.version,
        },
      },
      async () => {
        const result = await this.llm.followUpDraftStructured({
          channelHint,
          systemPrompt: prompt.promptTemplate,
          userContent,
          model: this.aiConfig.llmModel,
        });
        return {
          data: result.parsed,
          output: {
            draft_len: result.parsed.draft_text.length,
            confidence: result.parsed.confidence,
            channel_hint: channelHint,
            stub_mode: result.stubMode,
          },
          modelName: result.modelName,
          tokenUsage: result.tokenUsage,
        };
      },
    );

    const record = await this.recommendations.insert({
      entityType,
      entityId,
      recommendationType: 'follow_up_draft',
      text: wrapped.data.draft_text,
      actionJson: {
        channel_hint: channelHint,
        subject: wrapped.data.subject,
        stub_mode: !this.aiConfig.llmApiKey,
      },
      confidence: wrapped.data.confidence,
      agentRunId: wrapped.runId,
    });

    return this.toResponse(record, {
      requestId,
      latencyMs: wrapped.latencyMs,
      stubMode: !this.aiConfig.llmApiKey,
    });
  }

  async patchRecommendation(
    id: string,
    input: PatchRecommendationRequest,
  ): Promise<RecommendationResponse> {
    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    await this.assertRecommendationsReady();

    const rec = await this.recommendations.findById(id);
    if (!rec) {
      throw new NotFoundException({ error: 'recommendation_not_found', id });
    }

    const status = input.status;
    if (status !== 'accepted' && status !== 'dismissed') {
      throw new BadRequestException({
        error: 'invalid_status',
        message: 'status must be accepted or dismissed',
      });
    }

    if (rec.status !== 'pending') {
      throw new ConflictException({
        error: 'recommendation_not_pending',
        current_status: rec.status,
      });
    }

    const finalText = input.finalText?.trim() || rec.recommendation_text;
    if (status === 'accepted' && rec.recommendation_type !== 'nba' && rec.recommendation_type !== 'route_rep' && finalText.length < 10) {
      throw new BadRequestException({
        error: 'final_text_too_short',
        message: 'final_text must be at least 10 characters when accepting',
      });
    }

    let activityId: number | undefined;
    let caseEventId: number | undefined;
    if (status === 'accepted' && rec.recommendation_type === 'nba') {
      const eventOrActivityId =
        (await this.nba.executeNbaAccept(id, input.actorName ?? input.actorId ?? 'staff')) ?? undefined;
      if (rec.entity_type === 'lead') {
        activityId = eventOrActivityId;
      } else {
        caseEventId = eventOrActivityId;
      }
    } else if (status === 'accepted' && rec.recommendation_type === 'route_rep') {
      activityId =
        (await this.leadRoute.executeRouteAccept(
          id,
          input.actorName ?? input.actorId ?? 'staff',
          input.actorId ?? null,
        )) ?? undefined;
    } else if (status === 'accepted' && rec.entity_type === 'lead') {
      activityId = await this.createAcceptedActivity(rec, finalText, input);
    }

    const updated = await this.recommendations.updateStatus({
      id,
      status,
      recommendationText: status === 'accepted' ? finalText : undefined,
      acceptedBy: status === 'accepted' ? input.actorId ?? input.actorName ?? 'staff' : undefined,
      dismissedReason: status === 'dismissed' ? input.dismissReason?.trim() || 'dismissed_by_user' : undefined,
    });

    if (!updated) {
      throw new NotFoundException({ error: 'recommendation_not_found', id });
    }

    return this.toResponse(updated, {
      requestId,
      activityId,
      caseEventId,
      stubMode: Boolean(rec.action_json?.stub_mode),
    });
  }

  async listRecommendations(
    entityType: string,
    entityId: string,
    status?: RecommendationStatus,
    limit?: number,
    correlationId?: string,
  ): Promise<RecommendationListResponse> {
    await this.assertRecommendationsReady();
    const type = entityType?.trim() || 'lead';
    const id = entityId?.trim();
    if (!id) {
      throw new BadRequestException({ error: 'entity_id_required' });
    }

    const rows = await this.recommendations.listByEntity(type, id, status, limit ?? 10);
    return {
      data: {
        entity_type: type,
        entity_id: id,
        recommendations: rows,
      },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  private resolveChannel(raw?: FollowUpChannelHint | string): FollowUpChannelHint {
    const channel = String(raw ?? 'zalo').trim().toLowerCase() as FollowUpChannelHint;
    if (!FOLLOW_UP_CHANNELS.includes(channel)) {
      throw new BadRequestException({
        error: 'invalid_channel_hint',
        message: `channel_hint must be one of: ${FOLLOW_UP_CHANNELS.join(', ')}`,
      });
    }
    return channel;
  }

  private async assertRecommendationsReady(): Promise<void> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'schema_not_ready',
        message: 'ai_recommendations table is not ready',
      });
    }
  }

  private async buildFollowUpUserContent(
    leadId: number,
    ctx: NonNullable<Awaited<ReturnType<LeadScoreContextRepository['loadLeadScoreContext']>>>,
    contextText?: string,
  ): Promise<string> {
    const timelineBlock = await this.formatTimelineContext('lead', String(leadId), 12);
    const lines = [
      `LEAD_ID: ${leadId}`,
      `NAME_CHANNEL: ${ctx.channel ?? 'unknown'} / ${ctx.source ?? 'unknown'}`,
      ctx.campaignId ? `campaign_id=${ctx.campaignId}` : '',
      `STATUS: ${ctx.status ?? 'new'}`,
      `TIMELINE_EVENTS: ${ctx.timelineEventCount}`,
      contextText?.trim() ? `STAFF_NOTES:\n${contextText.trim().slice(0, 2000)}` : '',
      timelineBlock ? `TIMELINE:\n${timelineBlock}` : 'TIMELINE: (trống)',
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

  private async createAcceptedActivity(
    rec: Awaited<ReturnType<AiRecommendationsRepository['findById']>> & object,
    finalText: string,
    input: PatchRecommendationRequest,
  ): Promise<number> {
    const leadId = Number(rec.entity_id);
    const channel = this.resolveChannel(String(rec.action_json?.channel_hint ?? 'note'));
    const label = CHANNEL_LABELS[channel];
    const subject = rec.action_json?.subject ? String(rec.action_json.subject) : null;
    const actor = input.actorName?.trim() || input.actorId?.trim() || 'ai-copilot';

    const { activity } = await this.crmLegacy.createActivity(
      leadId,
      {
        activity_type: 'note',
        content: `[AI Follow-up draft — ${label}]\n\n${finalText}`,
        result: subject ? `Subject: ${subject}` : '',
        next_action: 'Copy nội dung và gửi thủ công qua kênh đã chọn (BR-AI-01).',
      },
      actor,
      input.actorUserId ?? null,
    );
    return activity.id;
  }

  private toResponse(
    record: NonNullable<Awaited<ReturnType<AiRecommendationsRepository['findById']>>>,
    opts: { requestId: string; latencyMs?: number; stubMode?: boolean; activityId?: number; caseEventId?: number },
  ): RecommendationResponse {
    const channelHint = this.resolveChannel(String(record.action_json?.channel_hint ?? 'note'));
    const subject =
      record.action_json?.subject != null && String(record.action_json.subject).trim()
        ? String(record.action_json.subject).trim()
        : null;
    return {
      data: {
        id: record.id,
        recommendation_type: record.recommendation_type,
        entity_type: record.entity_type,
        entity_id: record.entity_id,
        text: record.recommendation_text,
        channel_hint: channelHint,
        subject,
        confidence: record.confidence ?? 0.65,
        status: record.status,
        agent_run_id: record.agent_run_id ?? '',
        stub_mode: Boolean(opts.stubMode ?? record.action_json?.stub_mode),
        ...(opts.activityId != null ? { activity_id: opts.activityId } : {}),
        ...(opts.caseEventId != null ? { case_event_id: opts.caseEventId } : {}),
      },
      meta: {
        request_id: opts.requestId,
        ...(opts.latencyMs != null ? { latency_ms: opts.latencyMs } : {}),
      },
      errors: [],
    };
  }
}
