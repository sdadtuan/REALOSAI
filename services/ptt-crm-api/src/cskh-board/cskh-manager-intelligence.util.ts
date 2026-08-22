/** Phase 2 — Manager intelligence (SLA tiers, rep score, triage, daily digest). */

import {
  CSKH_SLA_TIER_LABELS,
  type CskhSlaTier,
  type CskhSlaTierSnapshot,
} from './cskh-board-sla.util';
import type { CskhBoardRow } from './cskh-board.types';

export type BreachRootCause = 'no_call' | 'no_b2' | 'no_close' | 'mixed';

export interface BreachLeadSnapshot {
  lead_id: number;
  full_name: string;
  phone: string;
  owner_id: number | null;
  owner_name: string | null;
  status: string;
  worst_tier: CskhSlaTier;
  tier_label: string;
  root_cause: BreachRootCause;
  root_cause_label: string;
  elapsed_minutes: number | null;
}

export interface RepPerformanceRow {
  owner_id: number;
  owner_name: string;
  active_leads: number;
  breach_first_call: number;
  breach_b2: number;
  breach_close: number;
  warning_total: number;
  weighted_breach_score: number;
  performance_score: number;
  rank: number;
}

export interface TriageSuggestion {
  from_owner_id: number;
  from_owner_name: string;
  breach_first_call_count: number;
  lead_ids: number[];
  suggested_to_owner_id: number | null;
  suggested_to_owner_name: string | null;
  reason: string;
}

export interface SlaDailyDigest {
  generated_at: string;
  tier_summary: Record<CskhSlaTier, { breach: number; warning: number; ok: number; active: number }>;
  root_cause_counts: Record<BreachRootCause, number>;
  top_breaches: BreachLeadSnapshot[];
  triage_suggestions: TriageSuggestion[];
  narrative: string;
  email_preview: string;
}

const ROOT_CAUSE_LABELS: Record<BreachRootCause, string> = {
  no_call: 'Chưa gọi lần đầu',
  no_b2: 'Chưa hoàn thành B2',
  no_close: 'Chưa chốt/lost trong 24h',
  mixed: 'Nhiều tier SLA',
};

const TIER_WEIGHT: Record<CskhSlaTier, number> = {
  first_call_15m: 3,
  b2_complete_4h: 2,
  close_24h: 1,
};

function tierSnapshot(row: CskhBoardRow, tier: CskhSlaTier): CskhSlaTierSnapshot | undefined {
  return row.sla_tiers.find((t) => t.tier === tier);
}

export function inferBreachRootCause(row: CskhBoardRow): BreachRootCause {
  const flags = {
    no_call: tierSnapshot(row, 'first_call_15m')?.sla_state === 'breach' && !row.first_call_at,
    no_b2: tierSnapshot(row, 'b2_complete_4h')?.sla_state === 'breach' && !row.b2_completed_at,
    no_close: tierSnapshot(row, 'close_24h')?.sla_state === 'breach' && !row.closed_at,
  };
  const hits = [flags.no_call, flags.no_b2, flags.no_close].filter(Boolean).length;
  if (hits > 1) return 'mixed';
  if (flags.no_call) return 'no_call';
  if (flags.no_b2) return 'no_b2';
  if (flags.no_close) return 'no_close';
  return 'mixed';
}

export function worstBreachTier(row: CskhBoardRow): CskhSlaTier {
  const order: CskhSlaTier[] = ['first_call_15m', 'b2_complete_4h', 'close_24h'];
  for (const tier of order) {
    if (tierSnapshot(row, tier)?.sla_state === 'breach') return tier;
  }
  for (const tier of order) {
    if (tierSnapshot(row, tier)?.sla_state === 'warning') return tier;
  }
  return row.sla_tier ?? 'first_call_15m';
}

export function buildTopBreachSnapshots(rows: CskhBoardRow[], limit = 5): BreachLeadSnapshot[] {
  const breaches = rows
    .filter((row) => row.sla_tiers.some((t) => t.sla_state === 'breach'))
    .map((row) => {
      const tier = worstBreachTier(row);
      const snap = tierSnapshot(row, tier);
      const root = inferBreachRootCause(row);
      return {
        lead_id: row.id,
        full_name: row.full_name,
        phone: row.phone,
        owner_id: row.owner_id,
        owner_name: row.owner_name,
        status: row.status,
        worst_tier: tier,
        tier_label: CSKH_SLA_TIER_LABELS[tier],
        root_cause: root,
        root_cause_label: ROOT_CAUSE_LABELS[root],
        elapsed_minutes: snap?.elapsed_minutes ?? row.sla_minutes_elapsed,
        sortWeight: TIER_WEIGHT[tier] * 1000 + (snap?.elapsed_minutes ?? 0),
      };
    })
    .sort((a, b) => b.sortWeight - a.sortWeight)
    .slice(0, limit);

  return breaches.map(({ sortWeight: _sort, ...rest }) => rest);
}

export function computeRepPerformance(rows: CskhBoardRow[]): RepPerformanceRow[] {
  const byOwner = new Map<number, RepPerformanceRow>();

  for (const row of rows) {
    if (!row.owner_id) continue;
    const existing = byOwner.get(row.owner_id) ?? {
      owner_id: row.owner_id,
      owner_name: row.owner_name ?? `#${row.owner_id}`,
      active_leads: 0,
      breach_first_call: 0,
      breach_b2: 0,
      breach_close: 0,
      warning_total: 0,
      weighted_breach_score: 0,
      performance_score: 100,
      rank: 0,
    };

    existing.active_leads += 1;
    const fc = tierSnapshot(row, 'first_call_15m');
    const b2 = tierSnapshot(row, 'b2_complete_4h');
    const close = tierSnapshot(row, 'close_24h');

    if (fc?.sla_state === 'breach') existing.breach_first_call += 1;
    if (b2?.sla_state === 'breach') existing.breach_b2 += 1;
    if (close?.sla_state === 'breach') existing.breach_close += 1;
    if (row.sla_tiers.some((t) => t.sla_state === 'warning')) existing.warning_total += 1;

    byOwner.set(row.owner_id, existing);
  }

  const scored = [...byOwner.values()].map((rep) => {
    const weighted =
      rep.breach_first_call * TIER_WEIGHT.first_call_15m +
      rep.breach_b2 * TIER_WEIGHT.b2_complete_4h +
      rep.breach_close * TIER_WEIGHT.close_24h;
    rep.weighted_breach_score = weighted;
    const rate = weighted / Math.max(rep.active_leads, 1);
    rep.performance_score = Math.max(0, Math.min(100, Math.round(100 - rate * 22)));
    return rep;
  });

  scored.sort((a, b) => b.performance_score - a.performance_score || a.weighted_breach_score - b.weighted_breach_score);
  return scored.map((rep, idx) => ({ ...rep, rank: idx + 1 }));
}

export function buildTriageSuggestions(rows: CskhBoardRow[], reps: RepPerformanceRow[]): TriageSuggestion[] {
  const byOwner = new Map<number, { owner_name: string; lead_ids: number[] }>();

  for (const row of rows) {
    if (!row.owner_id) continue;
    const fc = tierSnapshot(row, 'first_call_15m');
    if (fc?.sla_state !== 'breach') continue;
    const bucket = byOwner.get(row.owner_id) ?? {
      owner_name: row.owner_name ?? `#${row.owner_id}`,
      lead_ids: [],
    };
    bucket.lead_ids.push(row.id);
    byOwner.set(row.owner_id, bucket);
  }

  const suggestions: TriageSuggestion[] = [];
  const bestTarget = reps.filter((r) => r.performance_score >= 70).sort((a, b) => b.performance_score - a.performance_score)[0]
    ?? reps.sort((a, b) => b.performance_score - a.performance_score)[0];

  for (const [ownerId, bucket] of byOwner) {
    if (bucket.lead_ids.length < 2) continue;
    suggestions.push({
      from_owner_id: ownerId,
      from_owner_name: bucket.owner_name,
      breach_first_call_count: bucket.lead_ids.length,
      lead_ids: bucket.lead_ids,
      suggested_to_owner_id: bestTarget && bestTarget.owner_id !== ownerId ? bestTarget.owner_id : null,
      suggested_to_owner_name:
        bestTarget && bestTarget.owner_id !== ownerId ? bestTarget.owner_name : null,
      reason: `${bucket.owner_name} có ${bucket.lead_ids.length} lead breach SLA 15p — cân nhắc reassign.`,
    });
  }

  return suggestions.sort((a, b) => b.lead_ids.length - a.lead_ids.length);
}

export function countRootCauses(rows: CskhBoardRow[]): Record<BreachRootCause, number> {
  const out: Record<BreachRootCause, number> = {
    no_call: 0,
    no_b2: 0,
    no_close: 0,
    mixed: 0,
  };
  for (const row of rows) {
    if (!row.sla_tiers.some((t) => t.sla_state === 'breach')) continue;
    out[inferBreachRootCause(row)] += 1;
  }
  return out;
}

export function buildSlaDailyDigest(input: {
  rows: CskhBoardRow[];
  tierSummary: Record<CskhSlaTier, { breach: number; warning: number; ok: number; active: number }>;
  teamAcceptancePct?: number | null;
  now?: Date;
}): SlaDailyDigest {
  const now = input.now ?? new Date();
  const top = buildTopBreachSnapshots(input.rows, 5);
  const reps = computeRepPerformance(input.rows);
  const triage = buildTriageSuggestions(input.rows, reps);
  const root_cause_counts = countRootCauses(input.rows);

  const tierLines = (Object.keys(input.tierSummary) as CskhSlaTier[]).map((tier) => {
    const s = input.tierSummary[tier];
    return `${CSKH_SLA_TIER_LABELS[tier]}: ${s.breach} breach · ${s.warning} warning`;
  });

  const topLines = top.map(
    (t) => `#${t.lead_id} ${t.full_name || '—'} — ${t.tier_label} (${t.root_cause_label}) · ${t.owner_name ?? 'chưa gán'}`,
  );

  const narrativeParts = [
    `SLA digest ${now.toISOString().slice(0, 16)} UTC.`,
    tierLines.join(' · '),
    top.length ? `Top breach: ${top.length} lead cần xử lý.` : 'Không có breach đang mở.',
    root_cause_counts.no_call ? `${root_cause_counts.no_call} lead chưa gọi.` : '',
    root_cause_counts.no_b2 ? `${root_cause_counts.no_b2} lead chưa B2.` : '',
    root_cause_counts.no_close ? `${root_cause_counts.no_close} lead chưa chốt/lost.` : '',
    triage.length ? `${triage.length} gợi ý reassign (breach 15p lặp).` : '',
    input.teamAcceptancePct != null ? `AI acceptance team ${input.teamAcceptancePct}%.` : '',
  ].filter(Boolean);

  const email_preview = [
    `SLA Coach Digest — ${now.toISOString().slice(0, 10)}`,
    '',
    ...tierLines.map((l) => `- ${l}`),
    '',
    'Top 5 breach:',
    ...(topLines.length ? topLines.map((l) => `  · ${l}`) : ['  · Không có']),
    '',
    ...(triage.length
      ? ['Triage reassign:', ...triage.map((t) => `  · ${t.reason}`)]
      : ['Triage: không có gợi ý reassign']),
    '',
    'Xem: /crm/cskh-board · /crm/ai/coach',
    'Read-only — BR-AI-018.',
  ].join('\n');

  return {
    generated_at: now.toISOString(),
    tier_summary: input.tierSummary,
    root_cause_counts,
    top_breaches: top,
    triage_suggestions: triage,
    narrative: narrativeParts.join(' '),
    email_preview,
  };
}
