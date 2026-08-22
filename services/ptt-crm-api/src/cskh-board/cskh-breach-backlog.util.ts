import type { CskhBoardRow } from './cskh-board.types';
import type { CskhSlaTier } from './cskh-board-sla.util';

export const BREACH_BACKLOG_TARGET = 0;

export type CskhShiftKey = 'morning' | 'afternoon' | 'night';

export interface CskhShiftWindow {
  shift_key: CskhShiftKey;
  shift_label: string;
  shift_end_ict: string;
}

export interface BreachBacklogSnapshot {
  ok: true;
  generated_at: string;
  shift: CskhShiftWindow;
  target: number;
  backlog_count: number;
  gate_pass: boolean;
  unique_breach_leads: number;
  tier_breach_counts: Record<CskhSlaTier, number>;
  breach_lead_ids: number[];
}

/** ICT shift windows for CSKH ops (cuối ca gate). */
export function resolveCskhShift(now = new Date()): CskhShiftWindow {
  const ict = new Date(now.getTime() + 7 * 3_600_000);
  const hour = ict.getUTCHours();
  if (hour >= 6 && hour < 14) {
    return { shift_key: 'morning', shift_label: 'Ca sáng', shift_end_ict: '14:00' };
  }
  if (hour >= 14 && hour < 22) {
    return { shift_key: 'afternoon', shift_label: 'Ca chiều', shift_end_ict: '22:00' };
  }
  return { shift_key: 'night', shift_label: 'Ca đêm', shift_end_ict: '06:00' };
}

export function countUniqueBreachLeads(rows: CskhBoardRow[]): {
  unique_breach_leads: number;
  tier_breach_counts: Record<CskhSlaTier, number>;
  breach_lead_ids: number[];
} {
  const tier_breach_counts: Record<CskhSlaTier, number> = {
    first_call_15m: 0,
    b2_complete_4h: 0,
    close_24h: 0,
  };
  const breachIds = new Set<number>();

  for (const row of rows) {
    for (const tier of row.sla_tiers) {
      if (tier.sla_state !== 'breach') continue;
      tier_breach_counts[tier.tier] += 1;
      breachIds.add(row.id);
    }
  }

  return {
    unique_breach_leads: breachIds.size,
    tier_breach_counts,
    breach_lead_ids: [...breachIds].sort((a, b) => a - b),
  };
}

export function buildBreachBacklogSnapshot(rows: CskhBoardRow[], now = new Date()): BreachBacklogSnapshot {
  const counts = countUniqueBreachLeads(rows);
  const backlog_count = counts.unique_breach_leads;
  return {
    ok: true,
    generated_at: now.toISOString(),
    shift: resolveCskhShift(now),
    target: BREACH_BACKLOG_TARGET,
    backlog_count,
    gate_pass: backlog_count <= BREACH_BACKLOG_TARGET,
    unique_breach_leads: counts.unique_breach_leads,
    tier_breach_counts: counts.tier_breach_counts,
    breach_lead_ids: counts.breach_lead_ids,
  };
}
