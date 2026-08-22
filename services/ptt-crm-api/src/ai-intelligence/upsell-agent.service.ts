import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LifecycleTasksRepository } from '../service-lifecycle/lifecycle-tasks.repository';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiRecommendationRecord } from './recommendation.types';
import { computeUpsellSuggestions } from './upsell.engine';
import { UpsellContextRepository } from './upsell-context.repository';
import {
  UpsellApproveResponse,
  UpsellDismissResponse,
  UpsellListResponse,
  UpsellSuggestRequest,
  UpsellSuggestResponse,
  UpsellSuggestionView,
} from './upsell.types';

const UPSELL_TYPE = 'upsell';

@Injectable()
export class UpsellAgentService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly contextRepo: UpsellContextRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly lifecycleTasks: LifecycleTasksRepository,
  ) {}

  isEnabled(): boolean {
    return this.aiConfig.upsellEnabled;
  }

  async suggestUpsell(input: UpsellSuggestRequest): Promise<UpsellSuggestResponse> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException({
        error: 'upsell_disabled',
        message: 'PTT_AI_UPSELL_ENABLED is off',
      });
    }
    await this.assertReady();

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const clientId = input.client_id?.trim();
    const limit = input.limit ?? 3;

    if (clientId) {
      return this.suggestForClient(clientId, Boolean(input.force), limit, input.actorId ?? null, requestId);
    }

    const clientIds = this.contextRepo.listActiveClientIds(50);
    let created = 0;
    let skipped = 0;
    let agentRunId = '';

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.UPSELL_SUGGEST,
        entityType: 'agency_client',
        entityId: 'portfolio',
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'upsell-rules-v1',
        input: { client_count: clientIds.length },
      },
      async () => {
        for (const cid of clientIds) {
          const out = await this.suggestForClient(cid, false, 2, input.actorId ?? null, requestId, true);
          created += out.data.created;
          skipped += out.data.skipped;
          agentRunId = out.data.agent_run_id || agentRunId;
        }
        return {
          data: { created, skipped },
          output: { created, skipped, scanned: clientIds.length },
          modelName: 'upsell-rules-v1',
          tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    );

    return {
      data: {
        client_id: null,
        created: wrapped.data.created,
        skipped: wrapped.data.skipped,
        suggestions: [],
        agent_run_id: wrapped.runId,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async listForClient(clientId: string, correlationId?: string): Promise<UpsellListResponse> {
    await this.assertReady();
    const cid = clientId.trim();
    if (!cid) throw new BadRequestException({ error: 'client_id_required' });

    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const rows = (await this.recommendations.listByEntity('agency_client', cid, undefined, 30)).filter(
      (r) => r.recommendation_type === UPSELL_TYPE,
    );
    const suggestions = rows.map((row) => this.toView(row));

    return {
      data: { client_id: cid, suggestions, total: suggestions.length },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async approveUpsell(
    id: string,
    finalText: string | undefined,
    actorId?: string | null,
    actorEmail?: string | null,
    correlationId?: string,
  ): Promise<UpsellApproveResponse> {
    await this.assertReady();
    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const rec = await this.requirePendingUpsell(id);
    const draftText = String(finalText?.trim() || rec.recommendation_text || '').trim();
    if (draftText.length < 10) {
      throw new BadRequestException({ error: 'draft_required', message: 'Draft text too short' });
    }

    const lifecycleId =
      rec.action_json?.lifecycle_id != null ? Number(rec.action_json.lifecycle_id) : null;
    let followUpTaskId: number | null = null;
    if (lifecycleId && Number.isFinite(lifecycleId)) {
      const target = String(rec.action_json?.target_service_label ?? 'Upsell');
      const task = this.lifecycleTasks.createCustomTask(
        lifecycleId,
        'retain',
        `Upsell: ${target}`,
        draftText.slice(0, 4000),
      );
      followUpTaskId = task.id;
    }

    await this.audit.wrap(
      {
        useCase: AI_USE_CASE.UPSELL_APPROVE,
        entityType: 'agency_client',
        entityId: rec.entity_id,
        clientId: rec.client_id,
        actorId: actorEmail ?? actorId ?? 'am',
        correlationId: requestId,
        modelName: 'upsell-rules-v1',
        input: { recommendation_id: id, follow_up_task_id: followUpTaskId },
      },
      async () => ({
        data: { id, follow_up_task_id: followUpTaskId },
        output: { status: 'accepted' },
        modelName: 'upsell-rules-v1',
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    await this.recommendations.updateStatus({
      id,
      status: 'accepted',
      acceptedBy: actorEmail?.trim() || actorId?.trim() || 'am',
      recommendationText: draftText,
    });

    return {
      data: {
        id,
        status: 'accepted',
        follow_up_task_id: followUpTaskId,
        service_delivery_url:
          lifecycleId && Number.isFinite(lifecycleId) ? `/crm/service-delivery/${lifecycleId}` : null,
        note: 'Upsell draft đã duyệt — không auto-send (BR-AI-01).',
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async dismissUpsell(
    id: string,
    reason: string | undefined,
    actorId?: string | null,
    correlationId?: string,
  ): Promise<UpsellDismissResponse> {
    await this.assertReady();
    const requestId = correlationId?.trim() || this.audit.newRequestId();
    await this.requirePendingUpsell(id);

    await this.recommendations.updateStatus({
      id,
      status: 'dismissed',
      dismissedReason: reason?.trim() || 'dismissed_by_am',
    });

    return {
      data: { id, status: 'dismissed' },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  private async suggestForClient(
    clientId: string,
    force: boolean,
    limit: number,
    actorId: string | null,
    requestId: string,
    skipAudit = false,
  ): Promise<UpsellSuggestResponse> {
    const ctx = await this.contextRepo.loadContext(clientId);
    if (!ctx) {
      throw new NotFoundException({ error: 'client_not_found', client_id: clientId });
    }

    const computed = computeUpsellSuggestions(ctx, limit);
    let created = 0;
    let skipped = 0;

    const persist = async (agentRunId: string | null) => {
      for (const item of computed) {
        const dedupeKey = `${item.source_service_slug}:${item.target_service_slug}`;
        if (!force) {
          const pending = await this.recommendations.listByEntity('agency_client', clientId, 'pending', 20);
          const exists = pending.some(
            (r) =>
              r.recommendation_type === UPSELL_TYPE &&
              String(r.action_json?.dedupe_key ?? '') === dedupeKey,
          );
          if (exists) {
            skipped += 1;
            continue;
          }
        }

        await this.recommendations.insert({
          entityType: 'agency_client',
          entityId: clientId,
          clientId,
          recommendationType: UPSELL_TYPE,
          text: `${item.source_service_label} → ${item.target_service_label}: ${item.reason}`,
          actionJson: {
            dedupe_key: dedupeKey,
            source_service_slug: item.source_service_slug,
            source_service_label: item.source_service_label,
            target_service_slug: item.target_service_slug,
            target_service_label: item.target_service_label,
            lifecycle_id: item.lifecycle_id,
            health_score: ctx.healthScore,
            reason: item.reason,
            draft_text: item.draft_text,
            rule_id: item.rule_id,
            stub_mode: true,
          },
          confidence: item.confidence,
          agentRunId,
        });
        created += 1;
      }
    };

    if (skipAudit) {
      await persist(null);
      return {
        data: {
          client_id: clientId,
          created,
          skipped,
          suggestions: [],
          agent_run_id: '',
        },
        meta: { request_id: requestId },
        errors: [],
      };
    }

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.UPSELL_SUGGEST,
        entityType: 'agency_client',
        entityId: clientId,
        clientId,
        actorId,
        correlationId: requestId,
        modelName: 'upsell-rules-v1',
        input: { client_id: clientId, candidate_count: computed.length },
      },
      async () => ({
        data: { created: computed.length, skipped: 0 },
        output: { candidate_count: computed.length },
        modelName: 'upsell-rules-v1',
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    await persist(wrapped.runId);

    const list = await this.listForClient(clientId, requestId);
    return {
      data: {
        client_id: clientId,
        created,
        skipped,
        suggestions: list.data.suggestions.filter((s) => s.status === 'pending').slice(0, limit),
        agent_run_id: wrapped.runId,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  private async requirePendingUpsell(id: string): Promise<AiRecommendationRecord> {
    const rec = await this.recommendations.findById(id);
    if (!rec || rec.recommendation_type !== UPSELL_TYPE) {
      throw new NotFoundException({ error: 'upsell_not_found', id });
    }
    if (rec.status !== 'pending') {
      throw new BadRequestException({ error: 'upsell_not_pending', status: rec.status });
    }
    return rec;
  }

  private toView(row: AiRecommendationRecord): UpsellSuggestionView {
    const action = row.action_json ?? {};
    const lifecycleId = action.lifecycle_id != null ? Number(action.lifecycle_id) : null;
    return {
      id: row.id,
      client_id: row.entity_id,
      source_service_slug: String(action.source_service_slug ?? ''),
      source_service_label: String(action.source_service_label ?? ''),
      target_service_slug: String(action.target_service_slug ?? ''),
      target_service_label: String(action.target_service_label ?? ''),
      lifecycle_id: Number.isFinite(lifecycleId) ? lifecycleId : null,
      health_score: action.health_score != null ? Number(action.health_score) : null,
      confidence: row.confidence ?? 0.65,
      reason: String(action.reason ?? row.recommendation_text),
      draft_text: String(action.draft_text ?? row.recommendation_text),
      status: row.status,
      follow_up_task_id:
        action.follow_up_task_id != null ? Number(action.follow_up_task_id) : null,
      service_delivery_url:
        lifecycleId && Number.isFinite(lifecycleId) ? `/crm/service-delivery/${lifecycleId}` : null,
    };
  }

  private async assertReady(): Promise<void> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before upsell agent',
      });
    }
  }
}
