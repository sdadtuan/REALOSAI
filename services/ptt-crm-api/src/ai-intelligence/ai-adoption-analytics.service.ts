import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiAgentRunsRepository } from './ai-agent-runs.repository';
import { AiAuditService } from './ai-audit.service';
import { AiIntelligenceConfigService } from './ai-intelligence.config';
import { AiRecommendationsRepository } from './ai-recommendations.repository';
import { AiAdoptionMetricsResponse } from './feedback-analytics.types';

const COPILOT_USE_CASES = [
  'score_lead',
  'score_deal',
  'summarize',
  'route_rep',
  'follow_up_draft',
  'nba_suggest',
  'nl_query',
  'copilot_draft',
];

const ACCEPTANCE_TARGET_PCT = 40;
const DAU_TARGET_PCT = 60;

@Injectable()
export class AiAdoptionAnalyticsService {
  constructor(
    private readonly audit: AiAuditService,
    private readonly runs: AiAgentRunsRepository,
    private readonly recommendations: AiRecommendationsRepository,
    private readonly aiConfig: AiIntelligenceConfigService,
  ) {}

  async getAdoptionMetrics(
    query: { from?: string; to?: string; days?: number },
    correlationId?: string,
  ): Promise<AiAdoptionMetricsResponse> {
    await this.assertReady();
    const { from, to } = this.resolveWindow(query);
    const pilotDenominator = Math.max(this.aiConfig.pilotUserIds.length || 5, 1);

    const [dailyDau, acceptance] = await Promise.all([
      this.runs.getCopilotDailyDau({ from, to, useCases: COPILOT_USE_CASES }),
      this.recommendations.getAcceptanceMetrics({ from, to }),
    ]);

    const latestDau = dailyDau.length ? dailyDau[dailyDau.length - 1]?.dau ?? 0 : 0;
    const dauRatePct = Math.round((latestDau / pilotDenominator) * 1000) / 10;
    const acceptanceRatePct = acceptance.acceptance_rate_pct;
    const avgDau =
      dailyDau.length > 0
        ? Math.round((dailyDau.reduce((sum, row) => sum + row.dau, 0) / dailyDau.length) * 10) / 10
        : 0;

    return {
      data: {
        from,
        to,
        pilot_denominator: pilotDenominator,
        copilot_dau_latest: latestDau,
        copilot_dau_avg: avgDau,
        copilot_dau_rate_pct: dauRatePct,
        copilot_dau_target_pct: DAU_TARGET_PCT,
        copilot_dau_gate_pass: dauRatePct >= DAU_TARGET_PCT,
        acceptance_rate_pct: acceptanceRatePct,
        acceptance_target_pct: ACCEPTANCE_TARGET_PCT,
        acceptance_gate_pass:
          acceptanceRatePct != null && acceptanceRatePct >= ACCEPTANCE_TARGET_PCT,
        accepted: acceptance.accepted,
        dismissed: acceptance.dismissed,
        pending: acceptance.pending,
        total_resolved: acceptance.total_resolved,
        daily_dau: dailyDau,
        dod_v1_summary: {
          acceptance_ge_40: acceptanceRatePct != null && acceptanceRatePct >= ACCEPTANCE_TARGET_PCT,
          dau_ge_60_pilot: dauRatePct >= DAU_TARGET_PCT,
        },
      },
      meta: { request_id: correlationId?.trim() || this.audit.newRequestId() },
      errors: [],
    };
  }

  private resolveWindow(query: { from?: string; to?: string; days?: number }): {
    from: string;
    to: string;
  } {
    const days = Math.min(Math.max(Number(query.days ?? 14) || 14, 1), 90);
    if (query.from?.trim() && query.to?.trim()) {
      return { from: query.from.trim(), to: query.to.trim() };
    }
    const to = new Date();
    const from = new Date(to.getTime() - days * 86_400_000);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  private async assertReady(): Promise<void> {
    if (!(await this.runs.tableReady())) {
      throw new ServiceUnavailableException({
        error: 'ai_agent_runs_not_ready',
        message: 'Apply RNOS-01 DDL before adoption analytics',
      });
    }
  }
}
