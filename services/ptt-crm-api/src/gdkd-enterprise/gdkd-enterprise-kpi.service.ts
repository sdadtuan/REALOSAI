import { Injectable } from '@nestjs/common';
import { AiAdoptionAnalyticsService } from '../ai-intelligence/ai-adoption-analytics.service';
import { AiRecommendationsRepository } from '../ai-intelligence/ai-recommendations.repository';
import { CskhBoardService } from '../cskh-board/cskh-board.service';
import { LeadsFunnelService } from '../leads-funnel/leads-funnel.service';
import {
  buildGdkdEnterpriseKpiResponse,
  resolveGdkdMetricsWindow,
  type GdkdEnterpriseKpiResponse,
} from './gdkd-enterprise-kpi.util';

const CLOSED_LOOP_WINDOW_DAYS = 30;

@Injectable()
export class GdkdEnterpriseKpiService {
  constructor(
    private readonly cskhBoard: CskhBoardService,
    private readonly funnel: LeadsFunnelService,
    private readonly adoption: AiAdoptionAnalyticsService,
    private readonly recommendations: AiRecommendationsRepository,
  ) {}

  async getEnterpriseKpi(query: { days?: number } = {}): Promise<GdkdEnterpriseKpiResponse> {
    const { from, to, days } = resolveGdkdMetricsWindow(query.days);

    const [slaTiers, breachBacklog, reviewQueueMetrics, adoptionMetrics, nbaMetrics, closedLoop] =
      await Promise.all([
        this.cskhBoard.getSlaDashboardTiers(),
        this.cskhBoard.getBreachBacklogSnapshot(),
        this.funnel.reviewQueueMetrics(500),
        this.adoption.getAdoptionMetrics({ days }),
        this.recommendations.getAcceptanceMetrics({
          from,
          to,
          recommendationType: 'nba',
        }),
        this.cskhBoard.getClosedLoopDashboard(CLOSED_LOOP_WINDOW_DAYS, 5),
      ]);

    return buildGdkdEnterpriseKpiResponse({
      generatedAt: new Date().toISOString(),
      windowDays: days,
      closedLoopWindowDays: CLOSED_LOOP_WINDOW_DAYS,
      slaTiers,
      breachBacklog: breachBacklog.backlog_count,
      breachShiftLabel: breachBacklog.shift.shift_label,
      breachGatePass: breachBacklog.gate_pass,
      reviewQueueCount: reviewQueueMetrics.queue_count,
      reviewQueueMaxHours: reviewQueueMetrics.max_hours,
      reviewQueueAvgHours: reviewQueueMetrics.avg_hours,
      reviewQueueOver24h: reviewQueueMetrics.over_24h_count,
      reviewQueueAgeGatePass: reviewQueueMetrics.age_gate_pass,
      copilotDauRatePct: adoptionMetrics.data.copilot_dau_rate_pct,
      copilotDauLatest: adoptionMetrics.data.copilot_dau_latest,
      pilotDenominator: adoptionMetrics.data.pilot_denominator,
      nbaAcceptancePct: nbaMetrics.acceptance_rate_pct,
      nbaResolved: nbaMetrics.total_resolved,
      nbaAccepted: nbaMetrics.accepted,
      dealValueFillPct: closedLoop.summary.deal_value_fill_pct,
      vndFillGatePass: closedLoop.summary.vnd_fill_gate_pass ?? null,
      chotTotal: closedLoop.summary.chot_total,
    });
  }
}
