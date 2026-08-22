import { randomUUID } from 'crypto';
import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffOrInternalKeyGuard } from '../staff-auth/staff-or-internal-key.guard';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { AiAgentRunsService, AiAgentRunDetailResponse, AiAgentRunListResponse } from './ai-agent-runs.service';
import { AiDealScoreService } from './ai-deal-score.service';
import { AiLeadScoreService } from './ai-lead-score.service';
import { AiNbaService } from './ai-nba.service';
import { PipelineRiskService } from './pipeline-risk.service';
import { AiForecastService } from './ai-forecast.service';
import { RenewalAgentService } from './renewal-agent.service';
import { UpsellAgentService } from './upsell-agent.service';
import { AiChurnHealthService } from './ai-churn-health.service';
import { ManagerCoachService } from './manager-coach.service';
import { AnomalyDigestService } from './anomaly-digest.service';
import { AiLeadRouteService } from './ai-lead-route.service';
import { LmpSciAnalyticsService } from '../lead-meeting-prep/lmp-sci-analytics.service';
import { AiNlQueryService } from './ai-nl-query.service';
import { AiTicketSentimentService } from './ai-ticket-sentiment.service';
import {
  NlQueryCatalogResponse,
  NlQueryRunResponse,
} from './nl-query.types';
import { StaffMetaAlertsViewGuard } from '../meta-alerts/guards/staff-meta-alerts.guard';
import { StaffCasesViewGuard } from '../cases/guards/staff-cases.guard';
import { AiSummarizeService } from './ai-summarize.service';
import { AiRecommendationService } from './ai-recommendation.service';
import { AiFeedbackAnalyticsService } from './ai-feedback-analytics.service';
import { AiAdoptionAnalyticsService } from './ai-adoption-analytics.service';
import { AiScoreLatencyService } from './ai-score-latency.service';
import { AiIntelligenceService } from './ai-intelligence.service';
import { AiAgentRunStatus, AiHealthResponse } from './ai-intelligence.types';
import { ScoreDealResponse } from './deal-score.types';
import {
  PipelineRiskActivityResponse,
  PipelineRiskAssignResponse,
  PipelineRiskListResponse,
  PipelineRiskScanResponse,
} from './pipeline-risk.types';
import {
  ForecastCommitResponse,
  ForecastDashboardResponse,
  ForecastMapeReportResponse,
  ForecastSnapshotResponse,
  ForecastVarianceResponse,
} from './forecast.types';
import {
  RenewalApproveResponse,
  RenewalDraftResponse,
  RenewalListResponse,
  RenewalOutcomeResponse,
  RenewalPortfolioSummaryResponse,
  RenewalScanResponse,
} from './renewal.types';
import {
  UpsellApproveResponse,
  UpsellDismissResponse,
  UpsellListResponse,
  UpsellSuggestResponse,
} from './upsell.types';
import {
  ChurnHealthClientResponse,
  ChurnHealthDashboardResponse,
  ChurnRecoveryPlanResponse,
  ChurnRecoveryTimelineResponse,
  ChurnScoreResponse,
} from './churn-health.types';
import {
  CoachDigestCurrentResponse,
  CoachDigestGenerateResponse,
} from './coach-digest.types';
import { AnomalyDigestResponse } from './channel-anomaly.types';
import { TicketSentimentScoreResponse } from './ticket-sentiment.types';
import { AiScoresBatchResponse, AiScoresListResponse, ScoreLeadResponse } from './lead-score.types';
import { SummarizeResponse } from './summarize.types';
import {
  RecommendationListResponse,
  RecommendationResponse,
  RecommendationStatus,
} from './recommendation.types';
import {
  AiAcceptanceMetricsResponse,
  AiRecommendationInboxResponse,
} from './feedback-analytics.types';
import { StaffAiCopilotGuard } from './guards/staff-ai-copilot.guard';
import { StaffAiAdminGuard } from './guards/staff-ai-admin.guard';
import { StaffAiDealAccessGuard } from './guards/staff-ai-deal-access.guard';
import { StaffAiLeadAccessGuard } from './guards/staff-ai-lead-access.guard';
import { StaffAiScoreOverrideGuard } from './guards/staff-ai-score-override.guard';
import { StaffAiScoresBatchGuard } from './guards/staff-ai-scores-batch.guard';
import { StaffAiForecastCommitGuard } from './guards/staff-ai-forecast-commit.guard';
import { StaffAiForecastViewGuard } from './guards/staff-ai-forecast-view.guard';
import { StaffAiRenewalViewGuard } from './guards/staff-ai-renewal-view.guard';
import { StaffAiRenewalWriteGuard } from './guards/staff-ai-renewal-write.guard';
import { StaffAiChurnHealthViewGuard } from './guards/staff-ai-churn-health-view.guard';
import { StaffAiCoachViewGuard } from './guards/staff-ai-coach-view.guard';
import { StaffAiNlQueryGuard } from './guards/staff-ai-nl-query.guard';
import { StaffAiOrchestratorGuard } from './guards/staff-ai-orchestrator.guard';
import { StaffAiOrchestratorViewGuard } from './guards/staff-ai-orchestrator-view.guard';
import { StaffAiInsightsViewGuard } from './guards/staff-ai-insights-view.guard';
import { CplAnomalyService } from './cpl-anomaly.service';
import { BudgetRecommendService } from './budget-recommend.service';
import {
  OrchestratorDetailResponse,
  OrchestratorListResponse,
  OrchestratorRunResponse,
  OrchestratorService,
} from './orchestrator/orchestrator.service';
import { OrchestratorCronService } from './orchestrator/orchestrator-cron.service';
import { OrchestratorContext, AiOrchestrationStatus } from './orchestrator/orchestrator.types';

interface ScoreDealBody {
  deal_id: number;
  force?: boolean;
}

interface NextBestActionBody {
  deal_id?: number;
  lead_id?: number;
  entity_type?: string;
  entity_id?: string | number;
  force?: boolean;
}

interface RouteLeadBody {
  lead_id: number;
  force?: boolean;
}

interface ScoreLeadBody {
  lead_id: number;
  force?: boolean;
}

interface OverrideLeadScoreBody {
  lead_id: number;
  score: number;
  override_reason: string;
}

interface SummarizeBody {
  entity_type?: string;
  entity_id?: string | number;
  text?: string;
  context?: string;
}

interface RecommendationBody {
  type?: string;
  entity_type?: string;
  entity_id?: string | number;
  channel_hint?: string;
  context_text?: string;
}

interface PatchRecommendationBody {
  status?: 'accepted' | 'dismissed';
  final_text?: string;
  dismiss_reason?: string;
}

interface OrchestratorRunBody {
  planKey: string;
  clientId?: string;
  input: OrchestratorContext;
}

@Controller('api/v1/ai')
export class AiIntelligenceController {
  constructor(
    private readonly ai: AiIntelligenceService,
    private readonly runs: AiAgentRunsService,
    private readonly leadScore: AiLeadScoreService,
    private readonly dealScore: AiDealScoreService,
    private readonly nba: AiNbaService,
    private readonly summarize: AiSummarizeService,
    private readonly recommendations: AiRecommendationService,
    private readonly feedbackAnalytics: AiFeedbackAnalyticsService,
    private readonly adoptionAnalytics: AiAdoptionAnalyticsService,
    private readonly scoreLatency: AiScoreLatencyService,
    private readonly pipelineRisk: PipelineRiskService,
    private readonly forecast: AiForecastService,
    private readonly renewal: RenewalAgentService,
    private readonly upsell: UpsellAgentService,
    private readonly churnHealth: AiChurnHealthService,
    private readonly managerCoach: ManagerCoachService,
    private readonly nlQuery: AiNlQueryService,
    private readonly ticketSentiment: AiTicketSentimentService,
    private readonly anomalyDigest: AnomalyDigestService,
    private readonly cplAnomaly: CplAnomalyService,
    private readonly budgetRecommend: BudgetRecommendService,
    private readonly leadRoute: AiLeadRouteService,
    private readonly orchestrator: OrchestratorService,
    private readonly orchestratorCron: OrchestratorCronService,
    private readonly staffAuth: StaffAuthService,
    private readonly lmpSciAnalytics: LmpSciAnalyticsService,
  ) {}

  /** RNOS-02 — public smoke; records ai_agent_runs when schema ready (RNOS-05). */
  @Get('health')
  getHealth(
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiHealthResponse> {
    return this.ai.getHealth(correlationId?.trim() || requestId?.trim() || undefined);
  }

  /** RNOS-05 / AI-UC-009 — admin audit trail (BR-AI-05 redaction applied). */
  @Get('runs')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  listRuns(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('use_case') useCase?: string,
    @Query('actor_id') actorId?: string,
    @Query('entity_type') entityType?: string,
    @Query('entity_id') entityId?: string,
    @Query('status') status?: AiAgentRunStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiAgentRunListResponse> {
    return this.runs.list(
      {
        from,
        to,
        useCase,
        actorId,
        entityType,
        entityId,
        status,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  @Get('runs/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiAdminGuard)
  getRun(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiAgentRunDetailResponse> {
    return this.runs.getById(id, correlationId?.trim() || requestId?.trim() || undefined);
  }

  /** RNOS-31 — run a static multi-agent orchestration plan. */
  @Post('orchestrator/run')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiOrchestratorGuard)
  runOrchestrator(
    @Body() body: OrchestratorRunBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<OrchestratorRunResponse> {
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.orchestrator.run({
      planKey: body?.planKey,
      clientId: body?.clientId,
      input: body?.input,
      actorId,
      correlationId: correlationId?.trim() || requestId?.trim() || undefined,
    });
  }

  /** RNOS-31 — paginated orchestration trace list. */
  @Get('orchestrator')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiOrchestratorViewGuard)
  listOrchestrations(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('plan_key') planKey?: string,
    @Query('status') status?: AiOrchestrationStatus,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<OrchestratorListResponse> {
    return this.orchestrator.list(
      {
        from,
        to,
        planKey,
        status,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-31 — VPS cron hits this daily, following the RNOS-17/23 AI cron pattern. */
  @Post('orchestrator/cron/retain-health')
  @UseGuards(StaffOrInternalKeyGuard)
  runOrchestratorRetainHealthCron(
    @Body() body: { limit?: number; offset?: number },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.orchestratorCron.runDailyRetainHealth({
      limit: body?.limit,
      offset: body?.offset,
      actorId,
      correlationId: correlationId?.trim() || requestId?.trim() || undefined,
    });
  }

  /** RNOS-31 — retain-health cron enablement and plan status. */
  @Get('orchestrator/cron/status')
  @UseGuards(StaffOrInternalKeyGuard)
  getOrchestratorCronStatus() {
    return this.orchestratorCron.cronStatus();
  }

  /** RNOS-31 — orchestration detail with parent and child runs. */
  @Get('orchestrator/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiOrchestratorViewGuard)
  getOrchestration(
    @Param('id') id: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<OrchestratorDetailResponse> {
    return this.orchestrator.get(
      id,
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-04 — rules engine v1 + explainability (AI-UC-001, AI-UC-005). */
  @Post('score/lead')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  scoreLead(
    @Body() body: ScoreLeadBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ScoreLeadResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.leadScore.scoreLead({
      leadId: Number(body.lead_id),
      force: Boolean(body.force),
      actorId,
      correlationId: rid,
    });
  }

  /** AI-UC-006 / UI-R1-08 — GDKD manual score override (BR-AI-05). */
  @Post('scores/lead/override')
  @UseGuards(
    StaffOrInternalKeyGuard,
    StaffAiCopilotGuard,
    StaffAiLeadAccessGuard,
    StaffAiScoreOverrideGuard,
  )
  overrideLeadScore(
    @Body() body: OverrideLeadScoreBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ScoreLeadResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const actorEmail = req.staffUser?.email ?? null;
    return this.leadScore.overrideLeadScore({
      leadId: Number(body.lead_id),
      score: Number(body.score),
      overrideReason: body.override_reason ?? '',
      actorId,
      actorEmail,
      correlationId: rid,
    });
  }

  /** RNOS-09 — deal score rules v1 (AI-UC-012). */
  @Post('score/deal')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  scoreDeal(
    @Body() body: ScoreDealBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ScoreDealResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.dealScore.scoreDeal({
      dealId: Number(body.deal_id),
      force: Boolean(body.force),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-10 / AI-UC-011 — next best action for stalled deal or lead. */
  @Post('next-best-action')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiLeadAccessGuard)
  nextBestAction(
    @Body() body: NextBestActionBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const entityType = String(body.entity_type ?? (body.deal_id ? 'deal' : 'lead')).trim() || 'lead';
    return this.nba.suggestNextBestAction({
      deal_id: body.deal_id != null ? Number(body.deal_id) : undefined,
      lead_id: body.lead_id != null ? Number(body.lead_id) : undefined,
      entity_type: entityType,
      entity_id: body.entity_id ?? body.lead_id ?? body.deal_id,
      force: Boolean(body.force),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-26 — Lead Routing Agent v1: recommend rep (rules, human accept). */
  @Post('route/lead')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  routeLead(
    @Body() body: RouteLeadBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.leadRoute.suggestRouteRep({
      lead_id: Number(body.lead_id),
      force: Boolean(body.force),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-03 — summarize activity / lead brief (AI-UC-002, AI-UC-003). */
  @Post('summarize')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  summarizeText(
    @Body() body: SummarizeBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<SummarizeResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const entityType = body.entity_type?.trim() || (body.entity_id ? 'lead' : undefined);
    return this.summarize.summarize({
      context: (body.context?.trim() || 'activity') as 'lead_brief' | 'activity',
      entityType,
      entityId: body.entity_id != null ? String(body.entity_id) : undefined,
      text: body.text,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-04 / AI-UC-012 — batch scores (lead pilot cohort; deal sales funnel cap). */
  @Get('scores/batch')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiScoresBatchGuard)
  async listScoresBatch(
    @Query('entity_type') entityType: string,
    @Query('entity_ids') entityIdsRaw: string,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiScoresBatchResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const type = entityType || 'lead';
    const entityIds = String(entityIdsRaw ?? '')
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (type === 'deal') {
      const scoresByEntityId = await this.dealScore.listDealScoresBatch(entityIds, rid);
      return {
        data: { entity_type: 'deal', scores_by_entity_id: scoresByEntityId },
        meta: { request_id: rid ?? randomUUID() },
        errors: [],
      };
    }

    return this.leadScore.listScoresBatch(type, entityIds, req.staffUser, req.staffAuthVia, rid);
  }

  /** RNOS-04 — poll latest scores for Copilot (ops-web). */
  @Get('scores')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  listScores(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiScoresListResponse> {
    return this.leadScore.listScores(
      entityType || 'lead',
      entityId,
      limit ? Number(limit) : undefined,
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-07 — follow-up draft generate (AI-UC-004, BR-AI-01 no auto-send). */
  @Post('recommendation')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  async createRecommendation(
    @Body() body: RecommendationBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RecommendationResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const actorName = req.staffUser?.email ?? null;
    const actorUserId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    const entityType = body.entity_type?.trim() || 'lead';
    return this.recommendations.createFollowUpDraft({
      type: body.type?.trim() || 'follow_up_draft',
      entityType,
      entityId: body.entity_id != null ? String(body.entity_id) : '',
      channelHint: body.channel_hint as 'zalo' | 'email' | 'note' | undefined,
      contextText: body.context_text,
      actorId,
      actorName,
      actorUserId,
      correlationId: rid,
    });
  }

  /** S-LMP-6 — SCI win loop KPI dashboard. */
  @Get('analytics/sci')
  @UseGuards(StaffOrInternalKeyGuard)
  async getSciAnalytics(
    @Query('days') days?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const windowDays = days ? Number(days) : 30;
    const data = await this.lmpSciAnalytics.getMetrics(
      Number.isFinite(windowDays) ? windowDays : 30,
    );
    return {
      data,
      meta: { request_id: correlationId?.trim() || requestId?.trim() || '' },
      errors: [],
    };
  }

  /** RNOS-29 — AI acceptance feedback analytics (G6 KPI). */
  @Get('analytics/acceptance')
  @UseGuards(StaffOrInternalKeyGuard)
  getAcceptanceAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Query('recommendation_type') recommendationType?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiAcceptanceMetricsResponse> {
    return this.feedbackAnalytics.getAcceptanceMetrics(
      {
        from,
        to,
        days: days ? Number(days) : undefined,
        recommendation_type: recommendationType,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** E1 — dismiss reason breakdown for NBA tuning. */
  @Get('analytics/dismiss-reasons')
  @UseGuards(StaffOrInternalKeyGuard)
  getDismissReasonAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Query('recommendation_type') recommendationType?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.feedbackAnalytics.getDismissReasonMetrics(
      {
        from,
        to,
        days: days ? Number(days) : undefined,
        recommendation_type: recommendationType,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** §0.6 DoD v1 — copilot DAU + acceptance adoption dashboard. */
  @Get('analytics/adoption')
  @UseGuards(StaffOrInternalKeyGuard)
  getAdoptionAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.adoptionAnalytics.getAdoptionMetrics(
      {
        from,
        to,
        days: days ? Number(days) : undefined,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** Gate R1 #1 — lead created → score ≤30s (SQL on ai_scores + ai_agent_runs). */
  @Get('metrics/score-latency')
  @UseGuards(StaffOrInternalKeyGuard)
  getScoreLatencyMetrics(@Query('days') days?: string) {
    return this.scoreLatency.getScoreLatencyMetrics(days ? Number(days) : 7);
  }

  /** RNOS-29 — feedback inbox for managers (accept/dismiss history). */
  @Get('recommendations/inbox')
  @UseGuards(StaffOrInternalKeyGuard)
  listRecommendationsInbox(
    @Query('status') status?: RecommendationStatus,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AiRecommendationInboxResponse> {
    return this.feedbackAnalytics.listInbox(
      {
        status,
        from,
        to,
        days: days ? Number(days) : undefined,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-07 — list recommendations for entity. */
  @Get('recommendations')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  listRecommendations(
    @Query('entity_type') entityType: string,
    @Query('entity_id') entityId: string,
    @Query('status') status?: RecommendationStatus,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RecommendationListResponse> {
    return this.recommendations.listRecommendations(
      entityType || 'lead',
      entityId,
      status,
      limit ? Number(limit) : undefined,
      correlationId?.trim() || requestId?.trim() || undefined,
    );
  }

  /** RNOS-07 — accept/dismiss draft; accept creates CRM activity note only. */
  @Patch('recommendations/:id')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard, StaffAiLeadAccessGuard)
  async patchRecommendation(
    @Param('id') id: string,
    @Body() body: PatchRecommendationBody,
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RecommendationResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    const actorName = req.staffUser?.email ?? null;
    const actorUserId = await this.staffAuth.resolveCrmStaffUserId(req.staffUser);
    return this.recommendations.patchRecommendation(id, {
      status: body.status as 'accepted' | 'dismissed',
      finalText: body.final_text,
      dismissReason: body.dismiss_reason,
      actorId,
      actorName,
      actorUserId,
      correlationId: rid,
    });
  }

  /** RNOS-23 / AI-UC-015 — daily pipeline risk scan (internal cron or GDKD). */
  @Post('pipeline-risk/scan')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  scanPipelineRisk(
    @Body() body: { limit?: number },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<PipelineRiskScanResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.pipelineRisk.scanDaily({
      limit: body?.limit,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-23 / AI-UC-015 — at-risk deals for GDKD insights. */
  @Get('pipeline-risk/at-risk')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  listPipelineRiskDeals(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PipelineRiskListResponse> {
    return this.pipelineRisk.listAtRiskDeals(
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  /** AI-UC-015 b4 — assign follow-up owner on at-risk deal. */
  @Patch('pipeline-risk/:id/assign')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  assignPipelineRiskOwner(
    @Param('id') id: string,
    @Body() body: { staff_id: number; staff_name: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<PipelineRiskAssignResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.pipelineRisk.assignFollowUpOwner({
      recommendationId: id,
      staffId: Number(body.staff_id),
      staffName: String(body.staff_name ?? ''),
      actorId,
      correlationId: rid,
    });
  }

  /** AI-UC-015 b6 — log deal activity and clear pipeline risk flag. */
  @Post('pipeline-risk/:id/activity')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiDealAccessGuard)
  logPipelineRiskActivity(
    @Param('id') id: string,
    @Body() body: { note: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<PipelineRiskActivityResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.pipelineRisk.logFollowUpActivity({
      recommendationId: id,
      note: String(body.note ?? ''),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-17 / AI-UC-013 — daily revenue forecast snapshot (cron 07:00 ICT). */
  @Post('forecast')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastViewGuard)
  generateForecastSnapshot(
    @Body() body: { force?: boolean; snapshot_date?: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastSnapshotResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.forecast.generateSnapshot({
      force: Boolean(body?.force),
      snapshotDate: body?.snapshot_date,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-18 / UI-R3-01 — GDKD forecast dashboard for current month. */
  @Get('forecast/current')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastViewGuard)
  getForecastDashboard(
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastDashboardResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.forecast.getDashboard(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      rid,
    );
  }

  /** RNOS-18 / UI-R3-02 — GDKD commit forecast VND (BR: no auto-commit). */
  @Patch('forecast/commit')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastCommitGuard)
  commitForecast(
    @Body()
    body: {
      snapshot_id: string;
      committed_amount_vnd: number;
      acknowledge_mape_warning?: boolean;
    },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastCommitResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.forecast.commitForecast({
      snapshotId: body.snapshot_id,
      committedAmountVnd: Number(body.committed_amount_vnd),
      acknowledgeMapeWarning: Boolean(body.acknowledge_mape_warning),
      actorId,
      actorEmail: req.staffUser?.email ?? null,
      correlationId: rid,
    });
  }

  /** AI-UC-013 step 7 — leadership forecast variance on business dashboard. */
  @Get('forecast/variance')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastViewGuard)
  getForecastVariance(
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastVarianceResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.forecast.getForecastVariance(rid);
  }

  /** §19.3 #2 — MAPE report artifact for leadership. */
  @Get('forecast/mape-report')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiForecastViewGuard)
  getForecastMapeReport(
    @Query('months') months?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ForecastMapeReportResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.forecast.getMapeReport(months ? Number(months) : undefined, rid);
  }

  /** RNOS-20 / AI-UC-014 — scan contracts T-90/60/30 for renewal opportunities. */
  @Post('renewal/scan')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalViewGuard)
  scanRenewalWindows(
    @Body() body: { windows?: number[] },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RenewalScanResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.renewal.scanRenewalWindows({
      windows: body?.windows as (90 | 60 | 30)[] | undefined,
      actorId,
      correlationId: rid,
    });
  }

  /** WIN-3-B — renewal T-90/60/30 open opportunity counts for dashboard strip. */
  @Get('renewal/portfolio-summary')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalViewGuard)
  getRenewalPortfolioSummary(): Promise<RenewalPortfolioSummaryResponse> {
    return this.renewal.getPortfolioSummary();
  }

  /** RNOS-20 / UI-R3-03 — renewal opportunities for agency Retain tab. */
  @Get('renewal')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalViewGuard)
  listRenewalForClient(
    @Query('client_id') clientId: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RenewalListResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.renewal.listForClient(clientId, rid);
  }

  /** AI-UC-014 — generate renewal draft (BR-AI-01, no auto-send). */
  @Post('renewal/:id/draft')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalWriteGuard)
  generateRenewalDraft(
    @Param('id') id: string,
    @Body() body: { channel?: 'email' | 'zalo' },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RenewalDraftResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.renewal.generateDraft(id, body?.channel === 'email' ? 'email' : 'zalo', actorId, rid);
  }

  /** AI-UC-014 — AM approve draft → retain task (no outbound). */
  @Patch('renewal/:id/approve')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalWriteGuard)
  approveRenewalDraft(
    @Param('id') id: string,
    @Body() body: { final_text?: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RenewalApproveResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.renewal.approveDraft(id, body?.final_text, actorId, req.staffUser?.email ?? null, rid);
  }

  /** AI-UC-014 — mark renewal Won/Lost feedback loop. */
  @Patch('renewal/:id/outcome')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalWriteGuard)
  markRenewalOutcome(
    @Param('id') id: string,
    @Body() body: { outcome: 'renewed' | 'lost' },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<RenewalOutcomeResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.renewal.markOutcome(id, body.outcome, actorId, rid);
  }

  /** RNOS-27 — rules-based upsell suggestions for healthy agency clients. */
  @Post('upsell/suggest')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalViewGuard)
  suggestUpsell(
    @Body() body: { client_id?: string; force?: boolean; limit?: number },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<UpsellSuggestResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.upsell.suggestUpsell({
      client_id: body?.client_id,
      force: Boolean(body?.force),
      limit: body?.limit != null ? Number(body.limit) : undefined,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-27 / UI-R3-03 — upsell suggestions on agency Retain tab. */
  @Get('upsell')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalViewGuard)
  listUpsellForClient(
    @Query('client_id') clientId: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<UpsellListResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.upsell.listForClient(clientId, rid);
  }

  /** RNOS-27 — AM approve upsell draft → retain task (BR-AI-01). */
  @Patch('upsell/:id/approve')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalWriteGuard)
  approveUpsellDraft(
    @Param('id') id: string,
    @Body() body: { final_text?: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<UpsellApproveResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.upsell.approveUpsell(id, body?.final_text, actorId, req.staffUser?.email ?? null, rid);
  }

  /** RNOS-27 — dismiss upsell suggestion. */
  @Patch('upsell/:id/dismiss')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiRenewalWriteGuard)
  dismissUpsellDraft(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<UpsellDismissResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.upsell.dismissUpsell(id, body?.reason, actorId, rid);
  }

  /** RNOS-19 / AI-UC-017 — score churn health per agency client (cron / manual). */
  @Post('score/churn')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiChurnHealthViewGuard)
  scoreChurn(
    @Body() body: { client_id?: string; force?: boolean; limit?: number },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ChurnScoreResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.churnHealth.scoreChurn({
      client_id: body?.client_id,
      force: Boolean(body?.force),
      limit: body?.limit != null ? Number(body.limit) : undefined,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-19 / UI-R3-04 — CS health dashboard sorted by churn risk. */
  @Get('health')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiChurnHealthViewGuard)
  getChurnHealthDashboard(
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('ticket_spike') ticketSpike?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ChurnHealthDashboardResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.churnHealth.getDashboard(
      {
        sort,
        order,
        ticketSpike: ticketSpike === '1' || ticketSpike === 'true',
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      },
      rid,
    );
  }

  /** AI-UC-017 — latest health score for agency client detail tab. */
  @Get('health/client/:clientId')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiChurnHealthViewGuard)
  getClientChurnHealth(
    @Param('clientId') clientId: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ChurnHealthClientResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.churnHealth.getClientHealth(clientId, rid);
  }

  /** AI-UC-017 b6 — log churn recovery plan from /crm/health. */
  @Post('health/recovery-plan')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiChurnHealthViewGuard)
  logChurnRecoveryPlan(
    @Body() body: { client_id: string; note: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ChurnRecoveryPlanResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.churnHealth.logRecoveryPlan({
      clientId: body.client_id,
      note: String(body.note ?? ''),
      actorId,
      actorName: req.staffUser?.email ?? null,
      correlationId: rid,
    });
  }

  /** AI-UC-017 b6 — recovery plan timeline for health dashboard. */
  @Get('health/recovery-plans')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiChurnHealthViewGuard)
  listChurnRecoveryPlans(
    @Query('client_id') clientId?: string,
    @Query('limit') limit?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<ChurnRecoveryTimelineResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.churnHealth.listRecoveryPlans(
      clientId,
      limit ? Number(limit) : undefined,
      rid,
    );
  }

  /** RNOS-21 / AI-UC-018 — generate manager coach weekly digest (Mon 08:00 cron). */
  @Post('coach/generate')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCoachViewGuard)
  generateCoachDigest(
    @Body() body: { team_id?: string; force?: boolean },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<CoachDigestGenerateResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.managerCoach.generateDigest({
      team_id: body?.team_id,
      force: Boolean(body?.force),
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-21 / UI-R3-05 — GDKD coach digest dashboard. */
  @Get('coach/current')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCoachViewGuard)
  getCoachDigestCurrent(
    @Query('team_id') teamId?: string,
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<CoachDigestCurrentResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.managerCoach.getCurrentDigest(teamId, rid);
  }

  /** RNOS-28 / AI-UC-019 — channel CPL/ROAS anomaly narrative digest for hub banners. */
  @Get('anomaly/digest')
  @UseGuards(StaffOrInternalKeyGuard, StaffMetaAlertsViewGuard)
  getAnomalyDigest(
    @Query('client_id') clientId?: string,
    @Query('channel') channel?: string,
    @Query('days') days?: string,
    @Req()
    req?: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<AnomalyDigestResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req?.staffAuthVia === 'internal'
        ? 'system'
        : req?.staffUser?.sub ?? req?.staffUser?.email ?? null;
    return this.anomalyDigest.getDigest({
      client_id: clientId,
      channel,
      days: days ? Number(days) : undefined,
      actorId,
      correlationId: rid,
    });
  }

  /** WIN-4-C — weekly CPL anomaly narrative digest page API. */
  @Get('cpl-digest')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiInsightsViewGuard)
  getCplDigest(
    @Query('client_id') clientId?: string,
    @Query('channel') channel?: string,
    @Query('days') days?: string,
    @Req()
    req?: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req?.staffAuthVia === 'internal'
        ? 'system'
        : req?.staffUser?.sub ?? req?.staffUser?.email ?? null;
    return this.cplAnomaly.getWeeklyDigest({
      client_id: clientId,
      channel,
      days: days ? Number(days) : undefined,
      actorId,
      correlationId: rid,
    });
  }

  /** WIN-4-C — read-only Meta budget recommendations (no auto mutate). */
  @Get('budget-recommendations')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiInsightsViewGuard)
  getBudgetRecommendations(
    @Query('client_id') clientId?: string,
    @Query('channel') channel?: string,
    @Query('days') days?: string,
    @Req()
    req?: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  ) {
    return this.budgetRecommend.listRecommendations({
      staffUser: req?.staffUser,
      staffAuthVia: req?.staffAuthVia,
      client_id: clientId,
      channel,
      days,
    });
  }

  /** RNOS-22 / AI-UC-016 — curated NL analytics catalog (read-only whitelist). */
  @Get('query/catalog')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiNlQueryGuard)
  getNlQueryCatalog(
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): NlQueryCatalogResponse {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    return this.nlQuery.getCatalog(rid);
  }

  /** RNOS-22 / AI-UC-016 — run curated NL query (no free SQL). */
  @Post('query')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiNlQueryGuard)
  runNlQuery(
    @Body() body: { intent_id?: string; question?: string },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<NlQueryRunResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.nlQuery.runQuery({
      intent_id: body?.intent_id,
      question: body?.question,
      actorId,
      correlationId: rid,
    });
  }

  /** RNOS-24 — ticket sentiment scoring for CS health signals. */
  @Post('sentiment/ticket')
  @UseGuards(StaffOrInternalKeyGuard, StaffCasesViewGuard)
  scoreTicketSentiment(
    @Body() body: { ticket_id?: number; force?: boolean },
    @Req()
    req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
    @Headers('x-request-id') requestId?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ): Promise<TicketSentimentScoreResponse> {
    const rid = correlationId?.trim() || requestId?.trim() || undefined;
    const actorId =
      req.staffAuthVia === 'internal'
        ? 'system'
        : req.staffUser?.sub ?? req.staffUser?.email ?? null;
    return this.ticketSentiment.scoreTicket({
      ticket_id: Number(body?.ticket_id),
      force: Boolean(body?.force),
      actorId,
      correlationId: rid,
    });
  }

  /** Guard wiring check — requires copilot flag + pilot cohort (BR-AI-04 prep). */
  @Get('copilot/ping')
  @UseGuards(StaffOrInternalKeyGuard, StaffAiCopilotGuard)
  copilotPing(): { data: { ok: true; message: string }; meta: { request_id: string }; errors: [] } {
    return {
      data: { ok: true, message: 'copilot guard passed' },
      meta: { request_id: randomUUID() },
      errors: [],
    };
  }
}
