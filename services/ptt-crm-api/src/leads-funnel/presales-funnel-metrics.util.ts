import {
  CONSULT_PROPOSAL_SLA_HOURS,
  hoursBetween,
  isConsultToProposalWithin48h,
} from './presales-consult-sla.util';

export const CONSULT_TO_PROPOSAL_AGENCY_HOURS = 168;

export interface GoToConsultSample {
  intake_go_completed_at: string;
  consult_entered_at: string;
}

export interface GoToHandoffSample {
  intake_go_completed_at: string;
  handed_off_at: string;
}

export interface HandoffReleaseSample {
  handed_off_at: string;
  solution_released_at: string;
}

export interface ConsultTransitionSample {
  consult_entered_at: string;
  proposal_entered_at: string;
}

export interface ConsultTaskSample {
  form_fields: Array<{ key?: string }>;
  form_data: Record<string, unknown>;
  is_done: boolean;
}

export interface PresalesFunnelMetricsInput {
  go_to_consult: GoToConsultSample[];
  go_to_handoff: GoToHandoffSample[];
  handoff_to_release: HandoffReleaseSample[];
  consult_to_proposal: ConsultTransitionSample[];
  consult_tasks: ConsultTaskSample[];
}

export interface PresalesFunnelMetricsResult {
  go_to_consult_median_hours: number | null;
  go_to_consult_p90_hours: number | null;
  go_to_consult_sample: number;
  go_to_handoff_median_hours: number | null;
  go_to_handoff_p90_hours: number | null;
  go_to_handoff_sample: number;
  handoff_to_release_median_hours: number | null;
  handoff_to_release_p90_hours: number | null;
  handoff_to_release_sample: number;
  consult_to_proposal_7d_pct: number;
  consult_to_proposal_7d_num: number;
  consult_to_proposal_7d_denom: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
  consult_form_completion_pct: number;
  consult_task_done_rate: number;
  consult_tasks_total: number;
  consult_tasks_done: number;
}

export const PRESALES_FUNNEL_METRIC_LABELS = {
  consult_to_proposal_7d:
    'Consult → Báo giá ≤7 ngày (KPI agency) — mục tiêu ≥50% pilot / ≥60% 90 ngày',
  consult_to_proposal_48h:
    'Consult → Báo giá ≤48h (SLA vận hành) — mục tiêu theo gate P1',
  go_to_handoff:
    'Go → Giao Solution (team Sales) — mục tiêu ≤24h sau Intake Go',
  handoff_to_release:
    'Handoff → Trả Sales (team Solution) — thời gian xử lý Solution',
} as const;

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo] ?? null;
  const w = rank - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(num: number, denom: number): number {
  return denom > 0 ? round1((num / denom) * 100) : 0;
}

function fieldCompletion(task: ConsultTaskSample): number {
  const fields = task.form_fields ?? [];
  if (!fields.length) return task.is_done ? 100 : 0;
  let filled = 0;
  for (const field of fields) {
    const key = String(field.key ?? '').trim();
    if (!key) continue;
    const val = task.form_data?.[key];
    if (val != null && String(val).trim() !== '') filled += 1;
  }
  return (filled / fields.length) * 100;
}

export function computePresalesFunnelMetrics(
  input: PresalesFunnelMetricsInput,
): PresalesFunnelMetricsResult {
  const goHours: number[] = [];
  for (const row of input.go_to_consult) {
    const hrs = hoursBetween(row.intake_go_completed_at, row.consult_entered_at);
    if (hrs != null && hrs >= 0) goHours.push(hrs);
  }
  goHours.sort((a, b) => a - b);

  const handoffHours: number[] = [];
  for (const row of input.go_to_handoff) {
    const hrs = hoursBetween(row.intake_go_completed_at, row.handed_off_at);
    if (hrs != null && hrs >= 0) handoffHours.push(hrs);
  }
  handoffHours.sort((a, b) => a - b);

  const releaseHours: number[] = [];
  for (const row of input.handoff_to_release) {
    const hrs = hoursBetween(row.handed_off_at, row.solution_released_at);
    if (hrs != null && hrs >= 0) releaseHours.push(hrs);
  }
  releaseHours.sort((a, b) => a - b);

  let within7 = 0;
  let within48 = 0;
  const cpDenom = input.consult_to_proposal.length;
  for (const row of input.consult_to_proposal) {
    const hrs = hoursBetween(row.consult_entered_at, row.proposal_entered_at);
    if (hrs == null || hrs < 0) continue;
    if (hrs <= CONSULT_TO_PROPOSAL_AGENCY_HOURS) within7 += 1;
    if (isConsultToProposalWithin48h(row.consult_entered_at, row.proposal_entered_at)) {
      within48 += 1;
    }
  }

  const taskTotal = input.consult_tasks.length;
  const taskDone = input.consult_tasks.filter((t) => t.is_done).length;
  const completionSamples = input.consult_tasks.map(fieldCompletion);
  const avgCompletion =
    completionSamples.length > 0
      ? completionSamples.reduce((a, b) => a + b, 0) / completionSamples.length
      : 0;

  return {
    go_to_consult_median_hours:
      percentile(goHours, 50) != null ? round1(percentile(goHours, 50)!) : null,
    go_to_consult_p90_hours:
      percentile(goHours, 90) != null ? round1(percentile(goHours, 90)!) : null,
    go_to_consult_sample: goHours.length,
    go_to_handoff_median_hours:
      percentile(handoffHours, 50) != null ? round1(percentile(handoffHours, 50)!) : null,
    go_to_handoff_p90_hours:
      percentile(handoffHours, 90) != null ? round1(percentile(handoffHours, 90)!) : null,
    go_to_handoff_sample: handoffHours.length,
    handoff_to_release_median_hours:
      percentile(releaseHours, 50) != null ? round1(percentile(releaseHours, 50)!) : null,
    handoff_to_release_p90_hours:
      percentile(releaseHours, 90) != null ? round1(percentile(releaseHours, 90)!) : null,
    handoff_to_release_sample: releaseHours.length,
    consult_to_proposal_7d_pct: pct(within7, cpDenom),
    consult_to_proposal_7d_num: within7,
    consult_to_proposal_7d_denom: cpDenom,
    consult_to_proposal_48h_pct: pct(within48, cpDenom),
    consult_to_proposal_48h_num: within48,
    consult_to_proposal_48h_denom: cpDenom,
    consult_form_completion_pct: round1(avgCompletion),
    consult_task_done_rate: pct(taskDone, taskTotal),
    consult_tasks_total: taskTotal,
    consult_tasks_done: taskDone,
  };
}

export function isConsultToProposalWithin7d(
  consultEnteredAt: string | null,
  proposalEnteredAt: string | null,
): boolean {
  const hrs = hoursBetween(consultEnteredAt, proposalEnteredAt);
  if (hrs == null || hrs < 0) return false;
  return hrs <= CONSULT_TO_PROPOSAL_AGENCY_HOURS;
}

export { CONSULT_PROPOSAL_SLA_HOURS };
