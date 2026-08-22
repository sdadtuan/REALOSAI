import type { CskhBoardRow } from './cskh-board.types';
import type { CskhSlaTierSummary } from './cskh-board-sla.util';
import type { CskhSlaTier } from './cskh-board-sla.util';
import { countUniqueBreachLeads } from './cskh-breach-backlog.util';
import type { ReviewQueueMetrics } from '../leads-funnel/review-queue-metrics.util';

export interface HomeSummaryAiSlice {
  copilot_dau_pct: number | null;
  pilot_denominator: number;
  copilot_dau_latest: number;
  drill_href: string;
}

export interface HomeSummaryResponse {
  ok: true;
  generated_at: string;
  leads_new_today: number;
  sla: {
    breach_count: number;
    warning_count: number;
    compliance_pct: number | null;
    drill_href: string;
  };
  review_queue: {
    pending_count: number;
    max_age_hours: number | null;
    drill_href: string;
  };
  ai?: HomeSummaryAiSlice;
}

export function countUniqueWarningLeads(rows: CskhBoardRow[]): number {
  const warningIds = new Set<number>();
  for (const row of rows) {
    for (const tier of row.sla_tiers) {
      if (tier.sla_state === 'warning') {
        warningIds.add(row.id);
        break;
      }
    }
  }
  return warningIds.size;
}

export function aggregateSlaCompliancePct(
  tiers: Record<CskhSlaTier, CskhSlaTierSummary>,
): number | null {
  let ok = 0;
  let breach = 0;
  for (const tier of Object.values(tiers)) {
    ok += tier.ok;
    breach += tier.breach;
  }
  const evaluated = ok + breach;
  if (evaluated <= 0) return null;
  return Math.round((ok / evaluated) * 1000) / 10;
}

export function buildHomeSummary(input: {
  boardRows: CskhBoardRow[];
  tierSummaries: Record<CskhSlaTier, CskhSlaTierSummary>;
  leadsNewToday: number;
  reviewMetrics: Pick<ReviewQueueMetrics, 'queue_count' | 'max_hours'>;
  ai?: HomeSummaryAiSlice | null;
  now?: Date;
}): HomeSummaryResponse {
  const breach = countUniqueBreachLeads(input.boardRows);
  const warning_count = countUniqueWarningLeads(input.boardRows);

  return {
    ok: true,
    generated_at: (input.now ?? new Date()).toISOString(),
    leads_new_today: input.leadsNewToday,
    sla: {
      breach_count: breach.unique_breach_leads,
      warning_count,
      compliance_pct: aggregateSlaCompliancePct(input.tierSummaries),
      drill_href: '/crm/cskh-board?sla_filter=breach',
    },
    review_queue: {
      pending_count: input.reviewMetrics.queue_count,
      max_age_hours: input.reviewMetrics.max_hours,
      drill_href: '/crm/leads/review-queue',
    },
    ...(input.ai ? { ai: input.ai } : {}),
  };
}
