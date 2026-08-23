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

export interface HomeSummaryReBuyer {
  leads_new_today: number;
  breach_15m: number;
  drill_href: string;
}

export const RE_BUYER_HOME_DRILL =
  '/crm/cskh-board?flow=re_buyer&sla_filter=breach&sla_tier=first_call_15m';

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
  re_buyer?: HomeSummaryReBuyer;
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
  reBuyer?: { leads_new_today: number; breach_15m: number } | null;
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
    ...(input.reBuyer
      ? {
          re_buyer: {
            leads_new_today: input.reBuyer.leads_new_today,
            breach_15m: input.reBuyer.breach_15m,
            drill_href: RE_BUYER_HOME_DRILL,
          },
        }
      : {}),
  };
}
