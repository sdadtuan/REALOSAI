import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DomainEventService } from '../events/domain-event.service';
import { LeadsRepository } from '../leads/leads.repository';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiAuditService } from './ai-audit.service';
import { AiScoreRecord } from './lead-score.types';
import { AiScoresRepository } from './ai-scores.repository';
import { AiScoreFeedbackRepository } from './ai-score-feedback.repository';
import { AiScoreFeedbackService } from './ai-score-feedback.service';
import { computeLeadScoreV1, computeLeadScoreV2, buildTopFeatures } from './lead-score.engine';
import { LeadScoreContextRepository } from './lead-score-context.repository';
import {
  AiScoresBatchResponse,
  AiScoresListResponse,
  LEAD_SCORE_MODEL,
  LEAD_SCORE_MODEL_V2,
  LEAD_SCORE_MODEL_VERSION,
  LEAD_SCORE_MODEL_VERSION_V2,
  LEAD_SCORE_OVERRIDE_MODEL,
  OverrideLeadScoreRequest,
  OverrideLeadScoreResponse,
  ScoreBand,
  ScoreLeadRequest,
  ScoreLeadResponse,
} from './lead-score.types';

@Injectable()
export class AiLeadScoreService {
  constructor(
    private readonly scores: AiScoresRepository,
    private readonly contextRepo: LeadScoreContextRepository,
    private readonly audit: AiAuditService,
    private readonly events: DomainEventService,
    private readonly leads: LeadsRepository,
    private readonly staffAuth: StaffAuthService,
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly scoreFeedback: AiScoreFeedbackService,
  ) {}

  async scoreLead(input: ScoreLeadRequest): Promise<ScoreLeadResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_scores_not_ready',
        message: 'Apply RNOS-01 DDL before scoring',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const entityId = String(input.leadId);

    if (!input.force) {
      const recent = await this.scores.findRecentAutoScore('lead', entityId);
      if (recent) {
        return this.toScoreResponse(recent, input.leadId, requestId, true, recent.agent_run_id ?? '');
      }
    }

    const ctx = await this.contextRepo.loadLeadScoreContext(input.leadId);
    if (!ctx) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: input.leadId });
    }

    const useV2 = this.aiConfig.scoreV2Enabled;
    const modelName = useV2 ? LEAD_SCORE_MODEL_V2 : LEAD_SCORE_MODEL;
    const modelVersion = useV2 ? LEAD_SCORE_MODEL_VERSION_V2 : LEAD_SCORE_MODEL_VERSION;
    const feedback = useV2 ? await this.scoreFeedback.aggregateForLead(input.leadId) : null;
    const engineResult = useV2
      ? computeLeadScoreV2(ctx, feedback)
      : computeLeadScoreV1(ctx);

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.SCORE_LEAD,
        entityType: 'lead',
        entityId,
        clientId: input.clientId ?? ctx.clientId,
        actorId: input.actorId ?? null,
        correlationId: requestId,
        modelName,
        input: {
          lead_id: input.leadId,
          channel: ctx.channel,
          campaign_id: ctx.campaignId,
          features: engineResult.features,
          score_v2: useV2,
        },
      },
      async () => ({
        data: engineResult,
        output: {
          score: engineResult.score,
          confidence: engineResult.confidence,
          score_band: engineResult.explainability.score_band,
        },
        modelName,
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const row = await this.scores.insertScore({
      clientId: input.clientId ?? ctx.clientId,
      entityType: 'lead',
      entityId,
      scoreType: 'lead',
      scoreValue: wrapped.data.score,
      confidence: wrapped.data.confidence,
      features: wrapped.data.features,
      explainability: wrapped.data.explainability,
      agentRunId: wrapped.runId,
      modelName,
      modelVersion,
    });

    await this.events.emit(
      'LeadScored',
      'lead',
      entityId,
      {
        lead_id: input.leadId,
        score_id: row.id,
        score: row.score_value,
        confidence: row.confidence,
        agent_run_id: wrapped.runId,
        model: modelName,
        model_version: modelVersion,
        canonical_event: 'tenant.lead.scored',
      },
      requestId,
      `LeadScored:lead:${entityId}:${modelVersion}`,
    );

    return this.toScoreResponse(row, input.leadId, requestId, false, wrapped.runId);
  }

  /** AI-UC-006 / UI-R1-08 — GDKD manual score override (BR-AI-05). */
  async overrideLeadScore(input: OverrideLeadScoreRequest): Promise<OverrideLeadScoreResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_scores_not_ready',
        message: 'Apply RNOS-01 DDL before scoring',
      });
    }

    const scoreValue = Number(input.score);
    if (!Number.isFinite(scoreValue) || scoreValue < 0 || scoreValue > 100) {
      throw new BadRequestException({ error: 'score_out_of_range', message: 'score must be 0–100' });
    }

    const reason = String(input.overrideReason ?? '').trim();
    if (reason.length < 10) {
      throw new BadRequestException({
        error: 'override_reason_too_short',
        message: 'override_reason must be at least 10 characters',
      });
    }

    const actorId = String(input.actorId ?? input.actorEmail ?? 'gdkd').trim();
    if (!actorId) {
      throw new BadRequestException({ error: 'actor_required' });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const entityId = String(input.leadId);

    const lead = await this.leads.getLeadById(input.leadId);
    if (!lead) {
      throw new NotFoundException({ error: 'lead_not_found', lead_id: input.leadId });
    }

    const previous = await this.scores.getLatest('lead', entityId);
    const previousExplain = previous?.explainability_json ?? {
      factors: [],
      flags: [],
      score_band: 'warm' as ScoreBand,
    };
    const roundedScore = Math.round(scoreValue);
    const explainability = {
      factors: [
        ...(previousExplain.factors ?? []),
        {
          key: 'gdkd_override',
          label: `GDKD điều chỉnh: ${reason.slice(0, 120)}`,
          delta: 0,
          sign: '+' as const,
        },
      ],
      flags: [...(previousExplain.flags ?? []), 'manual_override'],
      score_band: this.scoreBand(roundedScore),
    };

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.OVERRIDE_SCORE,
        entityType: 'lead',
        entityId,
        clientId: input.clientId ?? previous?.client_id ?? null,
        actorId,
        correlationId: requestId,
        modelName: LEAD_SCORE_OVERRIDE_MODEL,
        input: {
          lead_id: input.leadId,
          score: roundedScore,
          override_reason: reason,
          previous_score_id: previous?.id ?? null,
        },
      },
      async () => ({
        data: { score: roundedScore, override_reason: reason },
        output: {
          score: roundedScore,
          overridden_by: actorId,
          score_band: explainability.score_band,
        },
        modelName: LEAD_SCORE_OVERRIDE_MODEL,
        tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }),
    );

    const row = await this.scores.insertOverrideScore({
      clientId: input.clientId ?? previous?.client_id ?? null,
      entityType: 'lead',
      entityId,
      scoreType: 'lead',
      scoreValue: roundedScore,
      confidence: previous?.confidence ?? 0.85,
      features: {
        source: 'manual_override',
        previous_score_id: previous?.id ?? null,
        previous_score_value: previous?.score_value ?? null,
      },
      explainability,
      agentRunId: wrapped.runId,
      overriddenBy: actorId,
      overrideReason: reason,
    });

    await this.events.emit(
      'LeadScoreOverridden',
      'lead',
      entityId,
      {
        lead_id: input.leadId,
        score_id: row.id,
        score: row.score_value,
        overridden_by: actorId,
        override_reason: reason,
        previous_score_id: previous?.id ?? null,
        agent_run_id: wrapped.runId,
        canonical_event: 'ai.score.overridden',
      },
      requestId,
      `LeadScoreOverridden:lead:${entityId}:${row.id}`,
    );

    await this.scoreFeedback.recordOverride({
      leadId: input.leadId,
      staffId: actorId,
      overrideScore: roundedScore,
    });

    return this.toScoreResponse(row, input.leadId, requestId, false, wrapped.runId);
  }

  async listScores(
    entityType: string,
    entityId: string,
    limit?: number,
    requestId?: string,
  ): Promise<AiScoresListResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({ error: 'ai_scores_not_ready' });
    }
    const scores = await this.scores.listScores(entityType, entityId, limit ?? 10);
    return {
      data: {
        entity_type: entityType,
        entity_id: entityId,
        scores,
        latest: scores[0] ?? null,
      },
      meta: { request_id: requestId ?? this.audit.newRequestId() },
      errors: [],
    };
  }

  /** UI-R1-10 — batch latest scores for leads list (BR-AI-04 filtered). */
  async listScoresBatch(
    entityType: string,
    entityIds: number[],
    staffUser: StaffJwtPayload | undefined,
    authVia: 'internal' | 'jwt' | undefined,
    requestId?: string,
  ): Promise<AiScoresBatchResponse> {
    if (!(await this.scores.tableReady())) {
      throw new ServiceUnavailableException({ error: 'ai_scores_not_ready' });
    }

    const uniqueIds = [...new Set(entityIds.filter((id) => Number.isFinite(id) && id > 0))].slice(0, 50);
    const allowedIds = await this.filterAccessibleLeadIds(uniqueIds, staffUser, authVia);
    const rows = await this.scores.listLatestForEntities(entityType || 'lead', allowedIds.map(String));

    const scoresByEntityId: Record<string, AiScoreRecord> = {};
    for (const row of rows) {
      scoresByEntityId[row.entity_id] = row;
    }

    return {
      data: {
        entity_type: entityType || 'lead',
        scores_by_entity_id: scoresByEntityId,
      },
      meta: { request_id: requestId ?? this.audit.newRequestId() },
      errors: [],
    };
  }

  private async filterAccessibleLeadIds(
    leadIds: number[],
    staffUser: StaffJwtPayload | undefined,
    authVia: 'internal' | 'jwt' | undefined,
  ): Promise<number[]> {
    if (!leadIds.length) {
      return [];
    }
    if (authVia === 'internal') {
      return leadIds;
    }
    if (!staffUser) {
      return [];
    }

    const me = await this.staffAuth.me(staffUser);
    if (this.staffAuth.hasCap(me.caps, 'crm_leads', 'assign')) {
      return leadIds;
    }

    const staffId = await this.staffAuth.resolveCrmStaffUserId(staffUser);
    const allowed: number[] = [];
    for (const leadId of leadIds) {
      const lead = await this.leads.getLeadById(leadId);
      if (staffId != null && lead?.owner_id != null && lead.owner_id === staffId) {
        allowed.push(leadId);
      }
    }
    return allowed;
  }

  private scoreBand(score: number): ScoreBand {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }

  private toScoreResponse(
    row: AiScoreRecord,
    leadId: number,
    requestId: string,
    idempotentReplay: boolean,
    agentRunId: string,
  ): ScoreLeadResponse {
    return {
      data: {
        score_id: row.id,
        lead_id: leadId,
        score: row.score_value,
        confidence: row.confidence ?? 0,
        score_band: row.explainability_json.score_band,
        explainability: row.explainability_json,
        top_features: buildTopFeatures(row.explainability_json),
        model_name: row.model_name ?? LEAD_SCORE_MODEL,
        model_version: row.model_version,
        agent_run_id: agentRunId,
        calculated_at: row.calculated_at,
        idempotent_replay: idempotentReplay,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }
}
