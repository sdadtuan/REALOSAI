import {
  CRM_MARKETING_PLAN_PRIORITY_LABELS,
  CRM_MARKETING_PLAN_STATUS_LABELS,
  MarketingPlanRow,
} from './marketing-plans.types';

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

export function mapPlanRow(row: Record<string, unknown>): MarketingPlanRow {
  const status = String(row.status ?? '');
  const priority = String(row.priority ?? '');
  return {
    id: Number(row.sqlite_plan_id ?? row.id),
    code: String(row.code ?? ''),
    name: String(row.name ?? ''),
    status,
    status_label: CRM_MARKETING_PLAN_STATUS_LABELS[status] ?? status,
    priority,
    priority_label: CRM_MARKETING_PLAN_PRIORITY_LABELS[priority] ?? priority,
    fiscal_year: Number(row.fiscal_year ?? 0),
    period_label: String(row.period_label ?? ''),
    north_star: String(row.north_star ?? ''),
    objectives: String(row.objectives ?? ''),
    pillars_json: String(row.pillars_json ?? '[]'),
    audiences: String(row.audiences ?? ''),
    channels_focus_json: String(row.channels_focus_json ?? '[]'),
    budget_planned_vnd: Number(row.budget_planned_vnd ?? 0),
    budget_actual_vnd: Number(row.budget_actual_vnd ?? 0),
    success_metrics_json: String(row.success_metrics_json ?? '[]'),
    risks_notes: String(row.risks_notes ?? ''),
    owner_staff_id: row.owner_staff_id != null ? Number(row.owner_staff_id) : null,
    owner_name: String(row.owner_name ?? ''),
    start_date: String(row.start_date ?? ''),
    end_date: String(row.end_date ?? ''),
    notes: String(row.notes ?? ''),
    strategy_framework_json: String(row.strategy_framework_json ?? '{}'),
    target_market_prof_json: String(row.target_market_prof_json ?? '{}'),
    target_market_steps4_json: String(row.target_market_steps4_json ?? '{}'),
    khtn_market_research_json: String(row.khtn_market_research_json ?? '{}'),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
    linked_campaign_count:
      row.linked_campaign_count != null ? Number(row.linked_campaign_count) : undefined,
    milestone_total: row.milestone_total != null ? Number(row.milestone_total) : undefined,
    milestone_done: row.milestone_done != null ? Number(row.milestone_done) : undefined,
  };
}
