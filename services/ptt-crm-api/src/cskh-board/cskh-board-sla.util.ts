/** CRM-UC-001 / CRM-UC-008 — Spa Meta 24h SLA tiers (SOP CSKH). */

import { parseStagesDoneJson } from '../leads-funnel/care-pipeline.util';

export const CSKH_FIRST_CALL_SLA_MINUTES = 15;
export const CSKH_B2_SLA_HOURS = 4;
export const CSKH_CLOSE_SLA_HOURS = 24;

export const CSKH_FIRST_CALL_WARNING_MINUTES = 5;
export const CSKH_B2_WARNING_MINUTES = 30;
export const CSKH_CLOSE_WARNING_MINUTES = 120;

export type CskhSlaState = 'ok' | 'warning' | 'breach' | 'na';
export type CskhSlaTier = 'first_call_15m' | 'b2_complete_4h' | 'close_24h';

/** GDKD / enterprise SLA compliance targets (% OK among evaluated ok+breach). */
export const CSKH_SLA_COMPLIANCE_TARGETS: Record<CskhSlaTier, number> = {
  first_call_15m: 85,
  b2_complete_4h: 80,
  close_24h: 70,
};

export interface CskhSlaTierCountSummary {
  breach: number;
  warning: number;
  ok: number;
  active: number;
}

export interface CskhSlaTierSummary extends CskhSlaTierCountSummary {
  compliance_pct: number | null;
  target_pct: number;
  compliance_pass: boolean | null;
  evaluated: number;
}

export interface CskhSlaTierSnapshot {
  tier: CskhSlaTier;
  label: string;
  sla_state: CskhSlaState;
  deadline_at: string | null;
  completed_at: string | null;
  elapsed_minutes: number | null;
  deadline_minutes: number;
}

export interface CskhSlaInput {
  status: string | null | undefined;
  receivedAt: string | Date | null | undefined;
  createdAt: string | Date | null | undefined;
  firstCallAt: string | Date | null | undefined;
  now?: Date;
}

export interface SpaMeta24hSlaInput {
  status: string | null | undefined;
  receivedAt: string | Date | null | undefined;
  createdAt: string | Date | null | undefined;
  firstCallAt: string | Date | null | undefined;
  careStagesDoneJson?: string | null;
  b2CompletedAt?: string | Date | null | undefined;
  closedAt?: string | Date | null | undefined;
  now?: Date;
}

const NEW_STATUSES = new Set(['new', 'moi', 'mới']);
const SPA_CLOSED_STATUSES = new Set(['chot', 'lost']);
const TERMINAL_STATUSES = new Set(['chot', 'lost', 'won', 'post_sale']);

const SLA_STATE_RANK: Record<CskhSlaState, number> = {
  na: 0,
  ok: 1,
  warning: 2,
  breach: 3,
};

export const CSKH_SLA_TIER_LABELS: Record<CskhSlaTier, string> = {
  first_call_15m: 'Gọi lần đầu (15p)',
  b2_complete_4h: 'Hoàn thành B2 (4h)',
  close_24h: 'Chốt / Lost (24h)',
};

export function isNewLeadStatus(status: string | null | undefined): boolean {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase();
  return NEW_STATUSES.has(raw);
}

export function isSpaClosedStatus(status: string | null | undefined): boolean {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase();
  return SPA_CLOSED_STATUSES.has(raw);
}

export function isTerminalLeadStatus(status: string | null | undefined): boolean {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase();
  return TERMINAL_STATUSES.has(raw);
}

export function parseB2CompletedAt(careStagesDoneJson: string | null | undefined): string | null {
  const done = parseStagesDoneJson(careStagesDoneJson);
  const ts = done.first_contact;
  return ts ? String(ts) : null;
}

function parseTs(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function worstSlaState(states: CskhSlaState[]): CskhSlaState {
  return states.reduce<CskhSlaState>(
    (worst, state) => (SLA_STATE_RANK[state] > SLA_STATE_RANK[worst] ? state : worst),
    'na',
  );
}

export function computeTimedSla(input: {
  active: boolean;
  anchor: Date | null;
  completedAt: Date | null;
  deadlineMinutes: number;
  warningBeforeMinutes: number;
  now?: Date;
}): {
  sla_state: CskhSlaState;
  deadline_at: string | null;
  completed_at: string | null;
  elapsed_minutes: number | null;
} {
  if (!input.active || !input.anchor) {
    return { sla_state: 'na', deadline_at: null, completed_at: null, elapsed_minutes: null };
  }

  const deadline = new Date(input.anchor.getTime() + input.deadlineMinutes * 60_000);
  const now = input.now ?? new Date();
  const completed = input.completedAt;

  if (completed) {
    const elapsed = Math.round((completed.getTime() - input.anchor.getTime()) / 60_000);
    const state: CskhSlaState =
      completed.getTime() <= deadline.getTime() ? 'ok' : 'breach';
    return {
      sla_state: state,
      deadline_at: deadline.toISOString(),
      completed_at: completed.toISOString(),
      elapsed_minutes: elapsed,
    };
  }

  const elapsedMin = Math.round((now.getTime() - input.anchor.getTime()) / 60_000);
  if (now.getTime() > deadline.getTime()) {
    return {
      sla_state: 'breach',
      deadline_at: deadline.toISOString(),
      completed_at: null,
      elapsed_minutes: elapsedMin,
    };
  }

  const warningStart = deadline.getTime() - input.warningBeforeMinutes * 60_000;
  if (now.getTime() >= warningStart) {
    return {
      sla_state: 'warning',
      deadline_at: deadline.toISOString(),
      completed_at: null,
      elapsed_minutes: elapsedMin,
    };
  }

  return {
    sla_state: 'ok',
    deadline_at: deadline.toISOString(),
    completed_at: null,
    elapsed_minutes: elapsedMin,
  };
}

export function computeFirstCallSla(input: CskhSlaInput): {
  sla_state: CskhSlaState;
  sla_minutes_elapsed: number | null;
  sla_deadline_at: string | null;
} {
  const anchor = parseTs(input.receivedAt) ?? parseTs(input.createdAt);
  const timed = computeTimedSla({
    active: isNewLeadStatus(input.status),
    anchor,
    completedAt: parseTs(input.firstCallAt),
    deadlineMinutes: CSKH_FIRST_CALL_SLA_MINUTES,
    warningBeforeMinutes: CSKH_FIRST_CALL_WARNING_MINUTES,
    now: input.now,
  });
  return {
    sla_state: timed.sla_state,
    sla_minutes_elapsed: timed.elapsed_minutes,
    sla_deadline_at: timed.deadline_at,
  };
}

export function computeSpaMeta24hSlas(input: SpaMeta24hSlaInput): {
  tiers: CskhSlaTierSnapshot[];
  worst_state: CskhSlaState;
  worst_tier: CskhSlaTier | null;
  sla_state: CskhSlaState;
  sla_tier: CskhSlaTier | null;
  sla_minutes_elapsed: number | null;
  sla_deadline_at: string | null;
} {
  const anchor = parseTs(input.receivedAt) ?? parseTs(input.createdAt);
  const now = input.now ?? new Date();
  const b2At = parseTs(input.b2CompletedAt ?? parseB2CompletedAt(input.careStagesDoneJson));
  const firstCallAt = parseTs(input.firstCallAt);
  const closedAt = parseTs(input.closedAt);
  const b2Complete = Boolean(b2At);
  const closed = isSpaClosedStatus(input.status);

  const firstCall = computeTimedSla({
    active: isNewLeadStatus(input.status),
    anchor,
    completedAt: firstCallAt,
    deadlineMinutes: CSKH_FIRST_CALL_SLA_MINUTES,
    warningBeforeMinutes: CSKH_FIRST_CALL_WARNING_MINUTES,
    now,
  });

  const b2 = computeTimedSla({
    active: !b2Complete && !isTerminalLeadStatus(input.status),
    anchor,
    completedAt: b2At,
    deadlineMinutes: CSKH_B2_SLA_HOURS * 60,
    warningBeforeMinutes: CSKH_B2_WARNING_MINUTES,
    now,
  });

  const close = computeTimedSla({
    active: !closed && !isTerminalLeadStatus(input.status),
    anchor,
    completedAt: closed ? closedAt ?? (isSpaClosedStatus(input.status) ? now : null) : null,
    deadlineMinutes: CSKH_CLOSE_SLA_HOURS * 60,
    warningBeforeMinutes: CSKH_CLOSE_WARNING_MINUTES,
    now,
  });

  const tiers: CskhSlaTierSnapshot[] = [
    {
      tier: 'first_call_15m',
      label: CSKH_SLA_TIER_LABELS.first_call_15m,
      sla_state: firstCall.sla_state,
      deadline_at: firstCall.deadline_at,
      completed_at: firstCall.completed_at,
      elapsed_minutes: firstCall.elapsed_minutes,
      deadline_minutes: CSKH_FIRST_CALL_SLA_MINUTES,
    },
    {
      tier: 'b2_complete_4h',
      label: CSKH_SLA_TIER_LABELS.b2_complete_4h,
      sla_state: b2.sla_state,
      deadline_at: b2.deadline_at,
      completed_at: b2.completed_at,
      elapsed_minutes: b2.elapsed_minutes,
      deadline_minutes: CSKH_B2_SLA_HOURS * 60,
    },
    {
      tier: 'close_24h',
      label: CSKH_SLA_TIER_LABELS.close_24h,
      sla_state: close.sla_state,
      deadline_at: close.deadline_at,
      completed_at: close.completed_at,
      elapsed_minutes: close.elapsed_minutes,
      deadline_minutes: CSKH_CLOSE_SLA_HOURS * 60,
    },
  ];

  const activeTiers = tiers.filter((t) => t.sla_state !== 'na');
  const worst_state = worstSlaState(activeTiers.map((t) => t.sla_state));
  const worst_tier =
    activeTiers
      .filter((t) => t.sla_state === worst_state)
      .sort((a, b) => SLA_STATE_RANK[b.sla_state] - SLA_STATE_RANK[a.sla_state])[0]?.tier ?? null;

  const focusTier =
    worst_tier ??
    activeTiers.find((t) => t.sla_state !== 'ok')?.tier ??
    activeTiers[0]?.tier ??
    null;
  const focusSnapshot = focusTier ? tiers.find((t) => t.tier === focusTier) ?? null : null;

  return {
    tiers,
    worst_state,
    worst_tier,
    sla_state: focusSnapshot?.sla_state ?? worst_state,
    sla_tier: focusTier,
    sla_minutes_elapsed: focusSnapshot?.elapsed_minutes ?? null,
    sla_deadline_at: focusSnapshot?.deadline_at ?? null,
  };
}

export function slaMatchesFilter(
  slaState: CskhSlaState,
  filter: 'all' | 'breach' | 'warning' | 'open',
): boolean {
  if (filter === 'all') return true;
  if (filter === 'breach') return slaState === 'breach';
  if (filter === 'warning') return slaState === 'warning' || slaState === 'breach';
  if (filter === 'open') return slaState === 'ok' || slaState === 'warning';
  return true;
}

export function tierSlaMatchesFilter(
  tier: CskhSlaTierSnapshot | undefined,
  filter: 'all' | 'breach' | 'warning' | 'open',
): boolean {
  if (!tier || tier.sla_state === 'na') return filter === 'all';
  return slaMatchesFilter(tier.sla_state, filter);
}

export function summarizeSlaTiers(rows: CskhSlaTierSnapshot[][]): Record<
  CskhSlaTier,
  { breach: number; warning: number; ok: number; active: number }
> {
  const out: Record<CskhSlaTier, { breach: number; warning: number; ok: number; active: number }> = {
    first_call_15m: { breach: 0, warning: 0, ok: 0, active: 0 },
    b2_complete_4h: { breach: 0, warning: 0, ok: 0, active: 0 },
    close_24h: { breach: 0, warning: 0, ok: 0, active: 0 },
  };

  for (const tiers of rows) {
    for (const tier of tiers) {
      if (tier.sla_state === 'na') continue;
      out[tier.tier].active += 1;
      if (tier.sla_state === 'breach') out[tier.tier].breach += 1;
      else if (tier.sla_state === 'warning') out[tier.tier].warning += 1;
      else if (tier.sla_state === 'ok') out[tier.tier].ok += 1;
    }
  }

  return out;
}

export function slaTierCompliancePct(stats: Pick<CskhSlaTierCountSummary, 'ok' | 'breach'>): number | null {
  const evaluated = stats.ok + stats.breach;
  if (evaluated <= 0) return null;
  return Math.round((stats.ok / evaluated) * 1000) / 10;
}

export function enrichSlaTierSummary(tier: CskhSlaTier, stats: CskhSlaTierCountSummary): CskhSlaTierSummary {
  const evaluated = stats.ok + stats.breach;
  const compliance_pct = slaTierCompliancePct(stats);
  const target_pct = CSKH_SLA_COMPLIANCE_TARGETS[tier];
  return {
    ...stats,
    evaluated,
    compliance_pct,
    target_pct,
    compliance_pass: compliance_pct == null ? null : compliance_pct >= target_pct,
  };
}

export function enrichSlaTierSummaries(
  tiers: Record<CskhSlaTier, CskhSlaTierCountSummary>,
): Record<CskhSlaTier, CskhSlaTierSummary> {
  return {
    first_call_15m: enrichSlaTierSummary('first_call_15m', tiers.first_call_15m),
    b2_complete_4h: enrichSlaTierSummary('b2_complete_4h', tiers.b2_complete_4h),
    close_24h: enrichSlaTierSummary('close_24h', tiers.close_24h),
  };
}
