import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { AI_USE_CASE } from './ai-audit.constants';
import { AiAuditService } from './ai-audit.service';
import { AiInsightsRepository } from './ai-insights.repository';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { buildCoachDigest, isoWeekKey, weekWindow } from './coach-digest.engine';
import {
  CoachDigestContext,
  CoachDigestCurrentResponse,
  CoachDigestGenerateRequest,
  CoachDigestGenerateResponse,
  CoachDigestRecord,
  CoachDigestSnapshot,
} from './coach-digest.types';
import { PipelineRiskService } from './pipeline-risk.service';
import { AnomalyDigestService } from './anomaly-digest.service';
import { CoachDigestDeliveryService } from './coach-digest-delivery.service';
import { LmpSciAnalyticsService } from '../lead-meeting-prep/lmp-sci-analytics.service';

const DEFAULT_TEAM_ID = 'org';

@Injectable()
export class ManagerCoachService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly insights: AiInsightsRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly cskhBoard: CskhBoardService,
    private readonly pipelineRisk: PipelineRiskService,
    private readonly anomalyDigest: AnomalyDigestService,
    private readonly delivery: CoachDigestDeliveryService,
    private readonly lmpSci: LmpSciAnalyticsService,
  ) {}

  async generateDigest(input: CoachDigestGenerateRequest = {}): Promise<CoachDigestGenerateResponse> {
    if (!(await this.insights.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_insights_not_ready',
        message: 'Apply RNOS-01 DDL before coach digest generate',
      });
    }

    const requestId = input.correlationId?.trim() || this.audit.newRequestId();
    const teamId = input.team_id?.trim() || DEFAULT_TEAM_ID;
    const force = Boolean(input.force);
    const weekKey = isoWeekKey();

    const existing = await this.insights.findCoachDigestForWeek(teamId, weekKey);
    if (existing && !force) {
      return {
        data: {
          created: false,
          skipped: true,
          digest: this.toRecord(existing),
          agent_run_id: existing.agent_run_id ?? '',
          generated_at: existing.created_at,
        },
        meta: { request_id: requestId },
        errors: [],
      };
    }

    const context = await this.buildContext(teamId, weekKey);
    const snapshot = buildCoachDigest(context);

    const wrapped = await this.audit.wrap(
      {
        useCase: AI_USE_CASE.COACH_DIGEST_GENERATE,
        entityType: 'team',
        entityId: teamId,
        actorId: input.actorId ?? 'system',
        correlationId: requestId,
        modelName: 'manager-coach-v1',
        input: { week_key: weekKey, team_id: teamId, force },
      },
      async () => {
        const row = await this.insights.insertCoachDigest({
          teamId,
          snapshot,
          agentRunId: null,
        });
        return {
          data: row,
          output: { week_key: weekKey, cards: snapshot.cards.length },
        };
      },
    );

    const row = wrapped.data;
    if (row.agent_run_id == null && wrapped.runId) {
      row.agent_run_id = wrapped.runId;
    }
    const delivery = await this.delivery.deliver({
      digestId: row.id,
      weekKey,
      teamId,
      emailPreview: snapshot.email_preview,
      metadata: row.metadata,
      force,
    });
    row.metadata = {
      ...row.metadata,
      email_status: delivery.status,
      ...(delivery.status === 'sent' ? { email_sent_at: new Date().toISOString() } : {}),
    };

    return {
      data: {
        created: true,
        skipped: false,
        digest: this.toRecord(row, snapshot),
        agent_run_id: wrapped.runId,
        generated_at: row.created_at,
      },
      meta: { request_id: requestId },
      errors: [],
    };
  }

  async getCurrentDigest(teamId = DEFAULT_TEAM_ID, correlationId?: string): Promise<CoachDigestCurrentResponse> {
    if (!(await this.insights.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_insights_not_ready',
        message: 'Apply RNOS-01 DDL before coach digest dashboard',
      });
    }

    const requestId = correlationId?.trim() || this.audit.newRequestId();
    const row = await this.insights.findLatestCoachDigest(teamId.trim() || DEFAULT_TEAM_ID);
    return {
      data: row ? this.toRecord(row) : null,
      meta: { request_id: requestId },
      errors: [],
    };
  }

  private async buildContext(teamId: string, weekKey: string): Promise<CoachDigestContext> {
    const window = weekWindow();
    const board = await this.cskhBoard.getBoard({ sla_filter: 'all', limit: 500, offset: 0 });

    let acceptance = {
      acceptance_rate_pct: null as number | null,
      accepted: 0,
      dismissed: 0,
      pending: 0,
      top_dismiss_reasons: [] as Array<{ reason: string; count: number }>,
    };
    if (await this.recommendations.tableReady()) {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const metrics = await this.recommendations.getAcceptanceMetrics({ from, to });
      acceptance = {
        acceptance_rate_pct: metrics.acceptance_rate_pct,
        accepted: metrics.accepted,
        dismissed: metrics.dismissed,
        pending: metrics.pending,
        top_dismiss_reasons: metrics.top_dismiss_reasons,
      };
    }

    let pipelineAtRisk = 0;
    try {
      const risk = await this.pipelineRisk.listAtRiskDeals(1, 0);
      pipelineAtRisk = risk.data.total;
    } catch {
      pipelineAtRisk = 0;
    }

    const channelAnomaly = await this.anomalyDigest.buildCoachFields(7);

    let sciMetrics = {
      prep_ready_count: 0,
      debrief_submitted_count: 0,
      helpful_rate_pct: null as number | null,
      tier_mix: { CB: 0, TC: 0, CS: 0, unknown: 0 },
    };
    try {
      sciMetrics = await this.lmpSci.getMetrics(7);
    } catch {
      sciMetrics = sciMetrics;
    }
    const tierEntries = Object.entries(sciMetrics.tier_mix).filter(([k]) => k !== 'unknown');
    const topTier =
      tierEntries.sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0)?.[0] ?? null;

    let managerIntel: Awaited<ReturnType<CskhBoardService['getManagerIntelligence']>> | null = null;
    try {
      managerIntel = await this.cskhBoard.getManagerIntelligence(acceptance.acceptance_rate_pct);
    } catch {
      managerIntel = null;
    }

    const tierSummary = board.sla_dashboard.tiers;
    const tierBreach = {
      first_call_15m: tierSummary.first_call_15m.breach,
      b2_complete_4h: tierSummary.b2_complete_4h.breach,
      close_24h: tierSummary.close_24h.breach,
    };
    const tierWarning = {
      first_call_15m: tierSummary.first_call_15m.warning,
      b2_complete_4h: tierSummary.b2_complete_4h.warning,
      close_24h: tierSummary.close_24h.warning,
    };
    const topBreachLines =
      managerIntel?.top_breaches.map(
        (t) => `#${t.lead_id} ${t.root_cause_label} (${t.tier_label})`,
      ) ?? [];

    return {
      team_id: teamId,
      week_key: weekKey,
      week_label: window.week_label,
      week_start: window.week_start,
      week_end: window.week_end,
      sla_breach: board.summary.breach,
      sla_warning: board.summary.warning,
      sla_ok: board.summary.ok,
      sla_tier_breach: tierBreach,
      sla_tier_warning: tierWarning,
      top_breach_lines: topBreachLines,
      root_cause_no_call: managerIntel?.root_cause_counts.no_call ?? 0,
      root_cause_no_b2: managerIntel?.root_cause_counts.no_b2 ?? 0,
      root_cause_no_close: managerIntel?.root_cause_counts.no_close ?? 0,
      acceptance_rate_pct: acceptance.acceptance_rate_pct,
      accepted: acceptance.accepted,
      dismissed: acceptance.dismissed,
      pending: acceptance.pending,
      top_dismiss_reasons: acceptance.top_dismiss_reasons,
      pipeline_at_risk: pipelineAtRisk,
      ...channelAnomaly,
      sci_prep_ready: sciMetrics.prep_ready_count,
      sci_debrief_count: sciMetrics.debrief_submitted_count,
      sci_helpful_rate_pct: sciMetrics.helpful_rate_pct,
      sci_top_tier: topTier,
    };
  }

  private toRecord(
    row: {
      id: string;
      agent_run_id: string | null;
      created_at: string;
      metadata: Record<string, unknown>;
      entity_id: string;
      description?: string;
      severity?: string;
    },
    snapshot?: CoachDigestSnapshot,
  ): CoachDigestRecord {
    const meta = row.metadata ?? {};
    const snap: CoachDigestSnapshot = snapshot ?? {
      week_key: String(meta.week_key ?? isoWeekKey()),
      week_label: String(meta.week_label ?? ''),
      week_start: String(meta.week_start ?? ''),
      week_end: String(meta.week_end ?? ''),
      team_id: String(meta.team_id ?? row.entity_id ?? DEFAULT_TEAM_ID),
      narrative: String(row.description ?? ''),
      severity: (row.severity as CoachDigestSnapshot['severity']) ?? 'info',
      cards: Array.isArray(meta.cards) ? (meta.cards as CoachDigestSnapshot['cards']) : [],
      email_preview: String(meta.email_preview ?? ''),
    };

    return {
      id: row.id,
      team_id: snap.team_id,
      week_key: snap.week_key,
      snapshot: snap,
      agent_run_id: row.agent_run_id,
      created_at: row.created_at,
    };
  }
}
