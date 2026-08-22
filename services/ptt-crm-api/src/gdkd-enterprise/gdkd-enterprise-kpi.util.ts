import type { CskhSlaTier, CskhSlaTierSummary } from '../cskh-board/cskh-board-sla.util';
import { CSKH_SLA_COMPLIANCE_TARGETS, slaTierCompliancePct } from '../cskh-board/cskh-board-sla.util';

export const GDKD_KPI_TARGETS = {
  first_call_15m_pct: CSKH_SLA_COMPLIANCE_TARGETS.first_call_15m,
  b2_4h_pct: CSKH_SLA_COMPLIANCE_TARGETS.b2_complete_4h,
  close_24h_pct: CSKH_SLA_COMPLIANCE_TARGETS.close_24h,
  breach_backlog: 0,
  review_queue_max_hours: 24,
  copilot_dau_pct: 60,
  nba_acceptance_pct: 35,
  roas_vnd_fill_pct: 90,
} as const;

export type GdkdKpiComparator = 'gte' | 'lte' | 'lt';

export interface GdkdEnterpriseKpiTile {
  id: string;
  label: string;
  value: number | null;
  value_display: string;
  target: number;
  target_display: string;
  comparator: GdkdKpiComparator;
  pass: boolean | null;
  /** E5 enterprise sign-off alias — same as `pass`. */
  gate_pass: boolean | null;
  unit: 'pct' | 'count' | 'hours';
  source: string;
  drill_href: string;
  detail?: string;
}

export interface GdkdEnterpriseKpiResponse {
  ok: true;
  generated_at: string;
  window_days: number;
  closed_loop_window_days: number;
  tiles: GdkdEnterpriseKpiTile[];
  summary: {
    pass_count: number;
    fail_count: number;
    na_count: number;
    total: number;
  };
}

export interface SlaTierCounts extends CskhSlaTierSummary {}

export { slaTierCompliancePct };

export function evaluateKpiPass(
  value: number | null,
  target: number,
  comparator: GdkdKpiComparator,
): boolean | null {
  if (value == null || Number.isNaN(value)) return null;
  if (comparator === 'gte') return value >= target;
  if (comparator === 'lte') return value <= target;
  return value < target;
}

function pctDisplay(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

function countDisplay(value: number | null): string {
  return value == null ? '—' : String(value);
}

function hoursDisplay(value: number | null): string {
  return value == null ? '—' : `${value}h`;
}

function buildTile(
  input: Omit<GdkdEnterpriseKpiTile, 'pass' | 'gate_pass'> & { pass?: boolean | null },
): GdkdEnterpriseKpiTile {
  const pass =
    input.pass !== undefined
      ? input.pass
      : evaluateKpiPass(input.value, input.target, input.comparator);
  return { ...input, pass, gate_pass: pass };
}

export function buildGdkdEnterpriseKpiResponse(input: {
  generatedAt: string;
  windowDays: number;
  closedLoopWindowDays: number;
  slaTiers: Record<CskhSlaTier, SlaTierCounts>;
  breachBacklog: number;
  breachShiftLabel: string;
  breachGatePass: boolean;
  reviewQueueCount: number;
  reviewQueueMaxHours: number | null;
  reviewQueueAvgHours: number | null;
  reviewQueueOver24h: number;
  reviewQueueAgeGatePass: boolean;
  copilotDauRatePct: number | null;
  copilotDauLatest: number;
  pilotDenominator: number;
  nbaAcceptancePct: number | null;
  nbaResolved: number;
  nbaAccepted: number;
  dealValueFillPct: number | null;
  vndFillGatePass: boolean | null;
  chotTotal: number;
}): GdkdEnterpriseKpiResponse {
  const firstCallPct = input.slaTiers.first_call_15m.compliance_pct ?? slaTierCompliancePct(input.slaTiers.first_call_15m);
  const b2Pct = input.slaTiers.b2_complete_4h.compliance_pct ?? slaTierCompliancePct(input.slaTiers.b2_complete_4h);
  const closePct = input.slaTiers.close_24h.compliance_pct ?? slaTierCompliancePct(input.slaTiers.close_24h);

  const reviewQueueValue =
    input.reviewQueueCount === 0 ? 0 : input.reviewQueueMaxHours;

  const tiles: GdkdEnterpriseKpiTile[] = [
    buildTile({
      id: 'first_call_15m',
      label: 'First call ≤15p',
      value: firstCallPct,
      value_display: pctDisplay(firstCallPct),
      target: GDKD_KPI_TARGETS.first_call_15m_pct,
      target_display: `≥${GDKD_KPI_TARGETS.first_call_15m_pct}%`,
      comparator: 'gte',
      unit: 'pct',
      source: 'SLA tier 15m',
      drill_href: '/crm/cskh-board?sla_tier=first_call_15m&sla_filter=breach',
      detail: `${input.slaTiers.first_call_15m.ok} OK / ${input.slaTiers.first_call_15m.evaluated || input.slaTiers.first_call_15m.ok + input.slaTiers.first_call_15m.breach} đánh giá`,
    }),
    buildTile({
      id: 'b2_4h',
      label: 'B2 ≤4h',
      value: b2Pct,
      value_display: pctDisplay(b2Pct),
      target: GDKD_KPI_TARGETS.b2_4h_pct,
      target_display: `≥${GDKD_KPI_TARGETS.b2_4h_pct}%`,
      comparator: 'gte',
      unit: 'pct',
      source: 'SLA tier 4h',
      drill_href: '/crm/cskh-board?sla_tier=b2_complete_4h&sla_filter=breach',
      detail: `${input.slaTiers.b2_complete_4h.ok} OK / ${input.slaTiers.b2_complete_4h.evaluated || input.slaTiers.b2_complete_4h.ok + input.slaTiers.b2_complete_4h.breach} đánh giá`,
    }),
    buildTile({
      id: 'close_24h',
      label: 'Close ≤24h',
      value: closePct,
      value_display: pctDisplay(closePct),
      target: GDKD_KPI_TARGETS.close_24h_pct,
      target_display: `≥${GDKD_KPI_TARGETS.close_24h_pct}%`,
      comparator: 'gte',
      unit: 'pct',
      source: 'SLA tier 24h',
      drill_href: '/crm/cskh-board?sla_tier=close_24h&sla_filter=breach',
      detail: `${input.slaTiers.close_24h.ok} OK / ${input.slaTiers.close_24h.evaluated || input.slaTiers.close_24h.ok + input.slaTiers.close_24h.breach} đánh giá`,
    }),
    buildTile({
      id: 'breach_backlog',
      label: 'Breach backlog',
      value: input.breachBacklog,
      value_display: countDisplay(input.breachBacklog),
      target: GDKD_KPI_TARGETS.breach_backlog,
      target_display: `${GDKD_KPI_TARGETS.breach_backlog} cuối ca`,
      comparator: 'lte',
      unit: 'count',
      source: 'CSKH board',
      drill_href: '/crm/cskh-board?sla_filter=breach',
      detail: `${input.breachShiftLabel} · ${input.breachBacklog} lead breach (unique) · 15p ${input.slaTiers.first_call_15m.breach} · 4h ${input.slaTiers.b2_complete_4h.breach} · 24h ${input.slaTiers.close_24h.breach}`,
      pass: input.breachGatePass,
    }),
    buildTile({
      id: 'review_queue_age',
      label: 'Review queue age',
      value: reviewQueueValue,
      value_display:
        input.reviewQueueCount === 0
          ? '0 lead'
          : `max ${hoursDisplay(input.reviewQueueMaxHours)} · avg ${input.reviewQueueAvgHours ?? '—'}h`,
      target: GDKD_KPI_TARGETS.review_queue_max_hours,
      target_display: `<${GDKD_KPI_TARGETS.review_queue_max_hours}h`,
      comparator: 'lt',
      unit: 'hours',
      source: 'Review queue',
      drill_href: '/crm/leads/review-queue',
      detail: `${input.reviewQueueCount} lead · ${input.reviewQueueOver24h} ≥24h`,
      pass: input.reviewQueueAgeGatePass,
    }),
    buildTile({
      id: 'copilot_dau',
      label: 'Copilot DAU (pilot)',
      value: input.copilotDauRatePct,
      value_display:
        input.copilotDauRatePct == null
          ? '—'
          : `${input.copilotDauLatest}/${input.pilotDenominator} (${input.copilotDauRatePct}%)`,
      target: GDKD_KPI_TARGETS.copilot_dau_pct,
      target_display: `≥${GDKD_KPI_TARGETS.copilot_dau_pct}%`,
      comparator: 'gte',
      unit: 'pct',
      source: 'AI insights',
      drill_href: '/crm/ai/insights',
    }),
    buildTile({
      id: 'nba_acceptance',
      label: 'AI NBA acceptance',
      value: input.nbaAcceptancePct,
      value_display:
        input.nbaAcceptancePct == null
          ? '—'
          : `${input.nbaAcceptancePct}% (${input.nbaAccepted}/${input.nbaResolved})`,
      target: GDKD_KPI_TARGETS.nba_acceptance_pct,
      target_display: `≥${GDKD_KPI_TARGETS.nba_acceptance_pct}%`,
      comparator: 'gte',
      unit: 'pct',
      source: 'ai_recommendations · type=nba',
      drill_href: '/crm/ai/insights?focus=nba',
      detail: `${input.nbaResolved} quyết định NBA (${input.windowDays} ngày)`,
    }),
    buildTile({
      id: 'roas_vnd_fill',
      label: 'ROAS closed-loop',
      value: input.dealValueFillPct,
      value_display: pctDisplay(input.dealValueFillPct),
      target: GDKD_KPI_TARGETS.roas_vnd_fill_pct,
      target_display: `≥${GDKD_KPI_TARGETS.roas_vnd_fill_pct}% VND filled`,
      comparator: 'gte',
      unit: 'pct',
      source: 'CRM chốt + hub',
      drill_href: '/crm/cskh-board',
      detail: `${input.chotTotal} chốt · ${input.closedLoopWindowDays} ngày`,
      pass: input.vndFillGatePass,
    }),
  ];

  const pass_count = tiles.filter((t) => t.pass === true).length;
  const fail_count = tiles.filter((t) => t.pass === false).length;
  const na_count = tiles.filter((t) => t.pass === null).length;

  return {
    ok: true,
    generated_at: input.generatedAt,
    window_days: input.windowDays,
    closed_loop_window_days: input.closedLoopWindowDays,
    tiles,
    summary: {
      pass_count,
      fail_count,
      na_count,
      total: tiles.length,
    },
  };
}

export function resolveGdkdMetricsWindow(days?: number): { from: string; to: string; days: number } {
  const windowDays = Math.min(Math.max(Number(days ?? 7) || 7, 1), 90);
  const to = new Date();
  const from = new Date(to.getTime() - windowDays * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString(), days: windowDays };
}
