import {
  DEFAULT_PROJECT_TYPE_LABELS,
  PROJECT_STATUS_LABELS,
  type ReProjectRow,
} from './re-projects.types';
import { defaultBusinessPlan, defaultMarketingPlan, defaultSalesPlan } from './re-projects-plan.util';

export function mapPgProjectRow(row: Record<string, unknown>): ReProjectRow {
  const pt = String(row.project_type ?? 'can_ho');
  const st = String(row.status ?? 'planning');
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
    total_land_area_m2: null,
    total_units: 0,
    sold_units: 0,
    sell_through_pct: 0,
    revenue_target_vnd: 0,
    start_date: '',
    presale_date: '',
    handover_date: '',
    description: String(row.description ?? ''),
    notes: String(row.notes ?? ''),
    business_plan: defaultBusinessPlan(),
    marketing_plan: defaultMarketingPlan(),
    sales_plan: defaultSalesPlan(),
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
