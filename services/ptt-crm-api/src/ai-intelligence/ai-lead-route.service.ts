import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CrmLeadsLegacyService } from '../crm-leads-legacy/crm-leads-legacy.service';
import { CustomerTimelineService } from '../customer-timeline/customer-timeline.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { computeLeadRouteV1 } from './lead-route.engine';
import { computeLeadRouteMlV1 } from './lead-route-ml.engine';
import { LeadRouteContextRepository } from './lead-route-context.repository';
import { RouteLeadRequest, RouteLeadResponse } from './lead-route.types';

@Injectable()
export class AiLeadRouteService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly routeContext: LeadRouteContextRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly crmLegacy: CrmLeadsLegacyService,
    private readonly timeline: CustomerTimelineService,
  ) {}

  isEnabled(): boolean {
    return this.aiConfig.leadRoutingEnabled;
  }

  async suggestRouteRep(input: RouteLeadRequest): Promise<RouteLeadResponse> {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException({
        error: 'lead_routing_disabled',
        message: 'PTT_AI_LEAD_ROUTING_ENABLED is off',
      });
    }

    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before lead routing',
      });
    }

    const leadId = Number(input.lead_id);
    if (!Number.isFinite(leadId) || leadId <= 0) {
      throw new BadRequestException({ error: 'lead_id_required' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();

    if (!input.force) {
      const pending = await this.recommendations.listByEntity('lead', String(leadId), 'pending', 5);
      const existing = pending.find((r) => r.recommendation_type === 'route_rep');
      if (existing) {
        return this.toResponse(existing, leadId, requestId);
      }
    }

    const ctx = await this.routeContext.loadRouteContext(leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: leadId });
    }

    const terminal = ['won', 'lost', 'converted', 'closed'].includes(String(ctx.status ?? '').toLowerCase());
    if (terminal) {
      throw new BadRequestException({
        error: 'lead_terminal',
        message: 'Không route lead đã đóng',
      });
    }

    if (ctx.ownerId != null && !input.force) {
      throw new BadRequestException({
        error: 'lead_already_owned',
        message: 'Lead đã có owner — dùng force=true để gợi ý lại',
        owner_id: ctx.ownerId,
      });
    }

    const routed = this.aiConfig.leadRoutingMlEnabled
      ? computeLeadRouteMlV1(ctx) ?? computeLeadRouteV1(ctx)
      : computeLeadRouteV1(ctx);
    if (!routed) {
      throw new BadRequestException({
        error: 'no_route_candidate',
        message: 'Không tìm thấy NV phù hợp trong pool phân lead',
      });
    }

    const modelName = routed.ruleId === 'route_ml_v1' ? 'lead-route-ml-v1' : 'lead-route-rules-v1';

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.ROUTE_REP,
        entityType: 'lead',
        entityId: String(leadId),
        clientId: ctx.clientId,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName,
        input: {
          lead_id: leadId,
          strategy: routed.strategy,
          recommended_staff_id: routed.recommendedStaffId,
          project_id: routed.projectId,
          ml: routed.ruleId === 'route_ml_v1',
        },
      },
      async () => ({
        data: routed,
        output: {
          staff_id: routed.recommendedStaffId,
          strategy: routed.strategy,
        },
        modelName,
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const record = await this.recommendations.insert({
      entityType: 'lead',
      entityId: String(leadId),
      recommendationType: 'route_rep',
      text: `Phân lead → ${routed.recommendedStaffName}: ${routed.reason}`,
      actionJson: {
        recommended_staff_id: routed.recommendedStaffId,
        recommended_staff_name: routed.recommendedStaffName,
        recommended_staff_code: routed.recommendedStaffCode,
        strategy: routed.strategy,
        reason: routed.reason,
        rule_id: routed.ruleId,
        project_id: routed.projectId,
        score_band: ctx.scoreBand,
        lead_score: ctx.leadScore,
        alternatives: routed.alternatives,
      },
      confidence: wrapped.data.confidence,
      agentRunId: wrapped.runId,
    });

    return this.toResponse(record, leadId, requestId, wrapped.runId);
  }

  async executeRouteAccept(
    recommendationId: string,
    actorName?: string | null,
    actorStaffId?: string | null,
  ): Promise<number | null> {
    const rec = await this.recommendations.findById(recommendationId);
    if (!rec || rec.recommendation_type !== 'route_rep' || rec.entity_type !== 'lead') {
      return null;
    }

    const leadId = Number(rec.entity_id);
    const toUserId = Number(rec.action_json?.recommended_staff_id);
    if (!Number.isFinite(leadId) || !Number.isFinite(toUserId) || toUserId <= 0) {
      return null;
    }

    const strategy = String(rec.action_json?.strategy ?? 'project_pool');
    const reason = `AI route_rep (${strategy})${actorName ? ` · ${actorName}` : ''}`;

    await this.crmLegacy.assignLead(
      leadId,
      { to_user_id: toUserId, reason },
      actorName ?? actorStaffId ?? 'staff',
    );

    const { activity } = await this.crmLegacy.createActivity(
      leadId,
      {
        activity_type: 'note',
        content: `[Route accepted] Phân cho ${String(rec.action_json?.recommended_staff_name ?? toUserId)}`,
        result: String(rec.action_json?.reason ?? rec.recommendation_text),
        next_action: 'Theo dõi SLA gọi lead đầu tiên.',
      },
      actorName ?? 'staff',
      actorStaffId ? Number(actorStaffId) || null : null,
    );

    await this.timeline.recordAiAction({
      entityType: 'lead',
      entityId: String(leadId),
      title: 'AI route accepted',
      body: String(rec.action_json?.reason ?? rec.recommendation_text),
      useCase: 'route_rep',
      actorId: actorName ?? actorStaffId ?? null,
      payload: {
        recommended_staff_id: toUserId,
        strategy: rec.action_json?.strategy ?? null,
      },
    });

    return activity.id;
  }

  private toResponse(
    record: Awaited<ReturnType<AiRecommendationsRepository['insert']>>,
    leadId: number,
    requestId: string,
    agentRunId?: string,
  ): RouteLeadResponse {
    return {
      data: {
        recommendation_id: record.id,
        lead_id: leadId,
        recommended_staff_id: Number(record.action_json?.recommended_staff_id ?? 0),
        recommended_staff_name: String(record.action_json?.recommended_staff_name ?? ''),
        recommended_staff_code: String(record.action_json?.recommended_staff_code ?? ''),
        strategy: String(record.action_json?.strategy ?? 'project_pool') as RouteLeadResponse['data']['strategy'],
        reason: String(record.action_json?.reason ?? record.recommendation_text),
        confidence: record.confidence ?? 0.65,
        status: record.status,
        recommendation_text: record.recommendation_text,
        agent_run_id: agentRunId ?? record.agent_run_id ?? '',
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
