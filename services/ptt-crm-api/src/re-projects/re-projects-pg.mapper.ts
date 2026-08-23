import {
  DEFAULT_PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  type ReProjectRow,
} from './re-projects.types';
import {
  defaultBusinessPlan,
  defaultMarketingPlan,
  defaultSalesPlan,
  mergePlan,
  parseJsonPlanValue,
} from './re-projects-plan.util';

export function mapPgProjectRow(row: Record<string, unknown>): ReProjectRow {
  const pt = String(row.project_type ?? 'can_ho');
  const st = String(row.status ?? 'planning');
  const total = Number(row.total_units ?? 0);
  const sold = Number(row.sold_units ?? 0);
  const bp = mergePlan(
    parseJsonPlanValue(row.business_plan_json, defaultBusinessPlan()),
    defaultBusinessPlan(),
  );
  const mp = mergePlan(
    parseJsonPlanValue(row.marketing_plan_json, defaultMarketingPlan()),
    defaultMarketingPlan(),
  );
  const sp = mergePlan(
    parseJsonPlanValue(row.sales_plan_json, defaultSalesPlan()),
    defaultSalesPlan(),
  );
  return {
    id: Number(row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    project_type: pt,
    project_type_label: DEFAULT_PROJECT_TYPE_LABELS[pt] ?? pt,
    status: st,
    status_label: PROJECT_STATUS_LABELS[st] ?? st,
    location_address: String(row.location_address ?? ''),
    district: String(row.district ?? ''),
    city: String(row.city ?? ''),
    developer_name: String(row.developer_name ?? ''),
    investor_name: String(row.investor_name ?? ''),
    total_land_area_m2: row.total_land_area_m2 != null ? Number(row.total_land_area_m2) : null,
    total_units: total,
    sold_units: sold,
    sell_through_pct: total > 0 ? Math.round((sold / total) * 1000) / 10 : 0,
    revenue_target_vnd: Number(row.revenue_target_vnd ?? 0),
    start_date: String(row.start_date ?? ''),
    presale_date: String(row.presale_date ?? ''),
    handover_date: String(row.handover_date ?? ''),
    description: String(row.description ?? ''),
    notes: String(row.notes ?? ''),
    business_plan: bp,
    marketing_plan: mp,
    sales_plan: sp,
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  return String(value ?? '');
}
