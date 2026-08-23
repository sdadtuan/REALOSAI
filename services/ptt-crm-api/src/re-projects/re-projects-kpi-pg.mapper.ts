import {
  BUDGET_CATEGORY_LABELS,
  KPI_TRACK_STATUS_LABELS,
  RISK_CATEGORY_LABELS,
  RISK_LEVEL_LABELS,
} from './re-projects.types';
import { KPI_TRACK_STATUSES } from './re-projects-kpi.util';

export type StaffLookup = Record<number, { name: string; job_title: string; department: string }>;
export type StaffKpiLookup = Record<number, { actual_value: number | null; status: string }>;

export function pgRowToPlain(row: Record<string, unknown>): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) d[k] = v.toISOString();
    else d[k] = v;
  }
  return d;
}

export function enrichKpiRow(
  d: Record<string, unknown>,
  staffMap: StaffLookup,
  staffKpiMap: StaffKpiLookup,
): void {
  const cat = String(d.category ?? '');
  d.category_label = cat;
  const tgt = Number(d.target_value ?? 0);
  const act = Number(d.actual_value ?? 0);
  d.achievement_pct = tgt > 0 ? Math.round((act / tgt) * 1000) / 10 : 0;
  let tr = String(d.track_status ?? 'active');
  if (!(KPI_TRACK_STATUSES as readonly string[]).includes(tr)) tr = 'active';
  d.track_status = tr;
  d.track_status_label = KPI_TRACK_STATUS_LABELS[tr] ?? tr;
  const sid = Number(d.owner_staff_id ?? 0);
  if (sid && staffMap[sid]) {
    const st = staffMap[sid];
    d.owner_display = String(st.name ?? d.owner_name ?? '');
    d.owner_job_title = String(st.job_title ?? '');
    d.owner_department = String(st.department ?? '');
  } else {
    d.owner_display = String(d.owner_name ?? '');
    d.owner_job_title = '';
    d.owner_department = '';
  }
  const skId = Number(d.staff_kpi_id ?? 0);
  d.synced_to_staff = skId > 0;
  if (skId > 0 && staffKpiMap[skId]) {
    const sk = staffKpiMap[skId];
    d.staff_kpi_status = String(sk.status ?? '');
    if (sk.actual_value != null) d.staff_kpi_actual = Number(sk.actual_value);
  }
}

export function enrichRiskRow(d: Record<string, unknown>): void {
  const cat = String(d.category ?? '');
  const lv = String(d.risk_level ?? '');
  d.category_label = RISK_CATEGORY_LABELS[cat] ?? cat;
  d.risk_level_label = RISK_LEVEL_LABELS[lv] ?? lv;
  d.score =
    Math.round((Number(d.probability_pct ?? 0) * Number(d.impact_pct ?? 0)) / 100 * 10) / 10;
}

export function enrichBudgetRow(d: Record<string, unknown>): void {
  const cat = String(d.category ?? '');
  d.category_label = BUDGET_CATEGORY_LABELS[cat] ?? cat;
  const pl = Number(d.planned_vnd ?? 0);
  const ac = Number(d.actual_vnd ?? 0);
  d.variance_vnd = ac - pl;
  d.variance_pct = pl ? Math.round(((ac - pl) / pl) * 1000) / 10 : 0;
}
