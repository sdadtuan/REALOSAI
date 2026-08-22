import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CasesService } from '../cases/cases.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { DealScoreContextRepository } from './deal-score-context.repository';
import { computeDealScoreV1 } from './deal-score.engine';
import {
  PipelineRiskActivityRequest,
  PipelineRiskActivityResponse,
  PipelineRiskAssignRequest,
  PipelineRiskAssignResponse,
  PipelineRiskListResponse,
  PipelineRiskListResult,
  PipelineRiskScanRequest,
  PipelineRiskScanResponse,
  PipelineRiskScanResult,
} from './pipeline-risk.types';

const PIPELINE_RISK_TYPE = 'pipeline_risk';

@Injectable()
export class PipelineRiskService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly dealContext: DealScoreContextRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly cases: CasesService,
  ) {}

  async scanDaily(input: PipelineRiskScanRequest = {}): Promise<PipelineRiskScanResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before pipeline risk scan',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const dealLimit = Math.min(Math.max(input.limit ?? 200, 1), 500);
    const dealIds = this.dealContext.listOpenDealIds(dealLimit);

    let atRiskFound = 0;
    let alertsCreated = 0;
    let alertsSkipped = 0;
    let alertsCleared = 0;

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.PIPELINE_RISK_SCAN,
        entityType: 'pipeline',
        entityId: 'daily',
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'pipeline-risk-v1',
        input: { deal_limit: dealLimit, deal_count: dealIds.length },
      },
      async () => {
        for (const dealId of dealIds) {
          const ctx = this.dealContext.loadDealScoreContext(dealId);
          if (!ctx || ctx.isTerminal) {
            continue;
          }

          const scored = computeDealScoreV1(ctx);
          const entityId = String(dealId);

          if (!scored.isStalled) {
            const cleared = await this.recommendations.dismissPendingByTypeForEntity(
              'deal',
              entityId,
              PIPELINE_RISK_TYPE,
              'risk_cleared',
            );
            alertsCleared += cleared;
            continue;
          }

          atRiskFound += 1;
          const existing = await this.recommendations.findRecentPendingByType(
            'deal',
            entityId,
            PIPELINE_RISK_TYPE,
            24,
          );
          if (existing) {
            alertsSkipped += 1;
            continue;
          }

          const reason = `Deal "${ctx.title}" at-risk: đứng im ${scored.stalledDays} ngày ở ${ctx.pipelineStage}.`;
          await this.recommendations.insert({
            entityType: 'deal',
            entityId,
            recommendationType: PIPELINE_RISK_TYPE,
            text: reason,
            actionJson: {
              deal_id: dealId,
              title: ctx.title,
              pipeline_stage: ctx.pipelineStage,
              stalled_days: scored.stalledDays,
              deal_score: scored.score,
              score_band: scored.explainability.score_band,
              risk_flags: scored.explainability.flags ?? [],
            },
            confidence: scored.confidence,
            agentRunId: null,
          });
          alertsCreated += 1;
        }

        const result: PipelineRiskScanResult = {
          scanned: dealIds.length,
          at_risk_found: atRiskFound,
          alerts_created: alertsCreated,
          alerts_skipped: alertsSkipped,
          alerts_cleared: alertsCleared,
          agent_run_id: '',
          scanned_at: new Date().toISOString(),
        };

        return {
          data: result,
          output: { ...result },
          modelName: 'pipeline-risk-v1',
          tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        };
      },
    );

    const data: PipelineRiskScanResult = {
      ...wrapped.data,
      agent_run_id: wrapped.runId,
    };

    return {
      data,
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async listAtRiskDeals(limit = 50, offset = 0): Promise<PipelineRiskListResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before listing pipeline risk',
      });
    }

    const requestId = this.audit.newRequestId();
    const { rows, total } = await this.recommendations.listPendingByType(
      PIPELINE_RISK_TYPE,
      limit,
      offset,
    );
    const lastScanAt = await this.recommendations.latestScanTimestamp(PIPELINE_RISK_TYPE);

    const deals = rows
      .filter((row) => row.entity_type === 'deal')
      .map((row) => {
        const action = row.action_json ?? {};
        const dealId = Number(row.entity_id);
        const ctx = Number.isFinite(dealId) ? this.dealContext.loadDealScoreContext(dealId) : null;
        const ownerId = action.follow_up_owner_id != null ? Number(action.follow_up_owner_id) : null;
        return {
          deal_id: dealId,
          title: String(action.title ?? ctx?.title ?? `Deal #${row.entity_id}`),
          pipeline_stage: String(action.pipeline_stage ?? ctx?.pipelineStage ?? ''),
          stalled_days: Number(action.stalled_days ?? 0),
          deal_score: Number(action.deal_score ?? 0),
          score_band: String(action.score_band ?? 'warm'),
          recommendation_id: row.id,
          staff_name: null,
          customer_name: null,
          follow_up_owner_id: Number.isFinite(ownerId) ? ownerId : null,
          follow_up_owner_name:
            action.follow_up_owner_name != null ? String(action.follow_up_owner_name) : null,
          assigned_at: action.assigned_at != null ? String(action.assigned_at) : null,
          scanned_at: row.created_at,
          status: row.status,
        };
      });

    const data: PipelineRiskListResult = {
      deals,
      total,
      last_scan_at: lastScanAt,
    };

    return {
      data,
      meta: { request_id: requestId },
      errors: [],
    };
  }

  /** AI-UC-015 b4 — assign follow-up owner on at-risk deal. */
  async assignFollowUpOwner(input: PipelineRiskAssignRequest): Promise<PipelineRiskAssignResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before pipeline risk assign',
      });
    }

    const recommendationId = input.recommendationId?.trim();
    const staffId = Number(input.staffId);
    const staffName = String(input.staffName ?? '').trim();
    if (!recommendationId) {
      throw new BadRequestException({ error: 'missing_recommendation_id', message: 'recommendation_id is required' });
    }
    if (!Number.isFinite(staffId) || staffId <= 0) {
      throw new BadRequestException({ error: 'invalid_staff_id', message: 'staff_id must be a positive number' });
    }
    if (!staffName) {
      throw new BadRequestException({ error: 'invalid_staff_name', message: 'staff_name is required' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const actorId = input.actorId?.trim() || 'gdkd';
    const row = await this.recommendations.findById(recommendationId);
    if (!row || row.recommendation_type !== PIPELINE_RISK_TYPE || row.status !== 'pending') {
      throw new NotFoundException({ error: 'recommendation_not_found', message: 'At-risk alert not found' });
    }

    const assignedAt = new Date().toISOString();
    await this.recommendations.mergeActionJson(recommendationId, {
      follow_up_owner_id: staffId,
      follow_up_owner_name: staffName,
      assigned_at: assignedAt,
      assigned_by: actorId,
    });

    const dealId = Number(row.entity_id);
    await this.audit.wrap(
      {
        useCase: AI_USE_CASE.PIPELINE_RISK_ASSIGN,
        entityType: 'deal',
        entityId: String(dealId),
        actorId,
        correlationId: requestId,
        modelName: 'pipeline-risk-v1',
        input: { recommendation_id: recommendationId, staff_id: staffId, staff_name: staffName },
      },
      async () => ({
        data: { assigned: true },
        output: { staff_id: staffId },
      }),
    );

    return {
      data: {
        recommendation_id: recommendationId,
        deal_id: dealId,
        follow_up_owner_id: staffId,
        follow_up_owner_name: staffName,
        assigned_at: assignedAt,
        assigned_by: actorId,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  /** AI-UC-015 b6 — log pipeline activity and clear risk flag. */
  async logFollowUpActivity(input: PipelineRiskActivityRequest): Promise<PipelineRiskActivityResponse> {
    if (!(await this.recommendations.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_recommendations_not_ready',
        message: 'Apply RNOS-01 DDL before pipeline risk activity',
      });
    }

    const recommendationId = input.recommendationId?.trim();
    const note = String(input.note ?? '').trim();
    if (!recommendationId) {
      throw new BadRequestException({ error: 'missing_recommendation_id', message: 'recommendation_id is required' });
    }
    if (!note) {
      throw new BadRequestException({ error: 'missing_note', message: 'note is required' });
    }
    if (note.length > 8000) {
      throw new BadRequestException({ error: 'note_too_long', message: 'note exceeds 8000 characters' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const actorId = input.actorId?.trim() || 'sales';
    const row = await this.recommendations.findById(recommendationId);
    if (!row || row.recommendation_type !== PIPELINE_RISK_TYPE || row.status !== 'pending') {
      throw new NotFoundException({ error: 'recommendation_not_found', message: 'At-risk alert not found' });
    }

    const dealId = Number(row.entity_id);
    if (!Number.isFinite(dealId) || dealId <= 0) {
      throw new BadRequestException({ error: 'invalid_deal_id', message: 'Invalid deal on recommendation' });
    }

    const event = this.cases.addEvent(dealId, { body: `[Pipeline follow-up] ${note}` });
    const cleared = await this.recommendations.dismissPendingByTypeForEntity(
      'deal',
      String(dealId),
      PIPELINE_RISK_TYPE,
      'activity_logged',
    );

    await this.audit.wrap(
      {
        useCase: AI_USE_CASE.PIPELINE_RISK_ACTIVITY,
        entityType: 'deal',
        entityId: String(dealId),
        actorId,
        correlationId: requestId,
        modelName: 'pipeline-risk-v1',
        input: { recommendation_id: recommendationId, event_id: event.id, cleared: cleared > 0 },
      },
      async () => ({
        data: { event_id: event.id },
        output: { risk_cleared: cleared > 0 },
      }),
    );

    return {
      data: {
        recommendation_id: recommendationId,
        deal_id: dealId,
        event_id: event.id,
        risk_cleared: cleared > 0,
        logged_at: event.created_at,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
