import type { CskhBoardRow } from './cskh-board.types';
import type { CskhSlaTier } from './cskh-board-sla.util';
import { CSKH_SLA_TIER_LABELS } from './cskh-board-sla.util';

export type SlaPredictRisk = 'low' | 'medium' | 'high' | 'imminent';

export type SlaPredictSuggestedAction =
  | 'log_call'
  | 'complete_b2'
  | 'set_chot_audit'
  | 'set_lost_reason'
  | 'reassign';

const RISK_RANK: Record<SlaPredictRisk, number> = {
  low: 1,
  medium: 2,
  high: 3,
  imminent: 4,
};

const TIER_ACTION: Record<CskhSlaTier, SlaPredictSuggestedAction> = {
  first_call_15m: 'log_call',
  b2_complete_4h: 'complete_b2',
  close_24h: 'set_chot_audit',
};

export interface SlaPredictRow {
  lead_id: number;
  lead_name: string;
  owner_id: number | null;
  tier: CskhSlaTier;
  minutes_remaining: number;
  risk: SlaPredictRisk;
  suggested_action: SlaPredictSuggestedAction;
  reason: string;
}

export function classifySlaPredictRisk(minutesRemaining: number): SlaPredictRisk | null {
  if (minutesRemaining <= 0) return null;
  if (minutesRemaining <= 5) return 'imminent';
  if (minutesRemaining <= 10) return 'high';
  if (minutesRemaining <= 20) return 'medium';
  return null;
}

export function predictSlaRisk(row: CskhBoardRow, now = new Date()): SlaPredictRow[] {
  const out: SlaPredictRow[] = [];

  for (const tier of row.sla_tiers) {
    if (tier.sla_state !== 'warning' || !tier.deadline_at) continue;

    const deadlineMs = new Date(tier.deadline_at).getTime();
    if (Number.isNaN(deadlineMs)) continue;

    const minutesRemaining = Math.round((deadlineMs - now.getTime()) / 60_000);
    const risk = classifySlaPredictRisk(minutesRemaining);
    if (!risk) continue;

    const label = CSKH_SLA_TIER_LABELS[tier.tier] ?? tier.tier;
    out.push({
      lead_id: row.id,
      lead_name: row.full_name || `#${row.id}`,
      owner_id: row.owner_id,
      tier: tier.tier,
      minutes_remaining: minutesRemaining,
      risk,
      suggested_action: TIER_ACTION[tier.tier],
      reason: `Còn ${minutesRemaining}p tới deadline ${label}`,
    });
  }

  return out.sort((a, b) => {
    const riskDiff = RISK_RANK[b.risk] - RISK_RANK[a.risk];
    if (riskDiff !== 0) return riskDiff;
    return a.minutes_remaining - b.minutes_remaining;
  });
}

export function predictSlaRiskForRows(rows: CskhBoardRow[], now = new Date()): SlaPredictRow[] {
  return rows
    .flatMap((row) => predictSlaRisk(row, now))
    .sort((a, b) => {
      const riskDiff = RISK_RANK[b.risk] - RISK_RANK[a.risk];
      if (riskDiff !== 0) return riskDiff;
      return a.minutes_remaining - b.minutes_remaining;
    });
}

export function filterPredictionsByOwner(
  rows: SlaPredictRow[],
  ownerId: number,
): SlaPredictRow[] {
  return rows.filter((row) => row.owner_id === ownerId);
}

export function filterPredictionsForAlerts(rows: SlaPredictRow[]): SlaPredictRow[] {
  return rows.filter((row) => row.risk === 'high' || row.risk === 'imminent');
}

export function slaPredictAlertHash(rows: SlaPredictRow[]): string {
  return rows
    .map((row) => `${row.lead_id}:${row.tier}:${row.risk}:${row.minutes_remaining}`)
    .sort()
    .join('|');
}
