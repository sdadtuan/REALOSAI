import type { HoldRow } from '../hold/bds-hold.repository';
import type { TxRow } from '../transactions/bds-tx.types';

const HOLD_RANK: Record<string, number> = {
  active: 3,
  pending: 2,
};

export function maskBdsPhone(phone: string, viewPii: boolean): string {
  const raw = String(phone ?? '').trim();
  if (viewPii || raw.length < 8) return raw;
  const head = raw.slice(0, 4);
  const tail = raw.slice(-4);
  return `${head}${'*'.repeat(Math.max(0, raw.length - 8))}${tail}`;
}

export function pickLatestHold(holds: HoldRow[]): HoldRow | null {
  if (!holds.length) return null;
  const sorted = [...holds].sort((a, b) => {
    const rankA = HOLD_RANK[a.status] ?? 0;
    const rankB = HOLD_RANK[b.status] ?? 0;
    if (rankB !== rankA) return rankB - rankA;
    return b.updated_at.getTime() - a.updated_at.getTime();
  });
  return sorted[0] ?? null;
}

export function pickLatestTx(txs: TxRow[]): TxRow | null {
  const open = txs.filter((tx) => tx.stage !== 'cancelled' && tx.stage !== 'lost');
  if (!open.length) return null;
  const sorted = [...open].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());
  return sorted[0] ?? null;
}

export type BdsSpineBuyerPayload = {
  lead_id: number;
  lead_flow_kind: 're_buyer';
  full_name: string;
  phone: string;
  re_project_id: number | null;
  unit_code: string | null;
  product_id: number | null;
  hold: { id: string; status: string; expires_at: string | null } | null;
  tx: { id: string; stage: string } | null;
  visits: Array<{ scheduled_at: string; outcome: string }>;
  utm: { source: string; campaign_id: string; ad_id: string };
  touched_at: string | null;
};

export type BdsBoardBuyerRow = {
  re_project_id: number | null;
  unit_code: string | null;
  hold_expires_at: string | null;
  tx_stage: string | null;
};
