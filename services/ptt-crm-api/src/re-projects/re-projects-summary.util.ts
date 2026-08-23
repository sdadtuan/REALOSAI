import { computeKpiBoardStats, computeProductInventoryStats } from './re-projects-inventory.util';
import type { ReProjectRow } from './re-projects.types';

export function buildProjectSummaryFromParts(
  proj: ReProjectRow,
  products: Array<Record<string, unknown>>,
  kpis: Array<Record<string, unknown>>,
  risks: Array<Record<string, unknown>>,
  budget: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const revPlanned = budget
    .filter((b) => b.category === 'revenue')
    .reduce((s, b) => s + Number(b.planned_vnd ?? 0), 0);
  const revActual = budget
    .filter((b) => b.category === 'revenue')
    .reduce((s, b) => s + Number(b.actual_vnd ?? 0), 0);
  const costPlanned = budget
    .filter((b) => b.category !== 'revenue')
    .reduce((s, b) => s + Number(b.planned_vnd ?? 0), 0);
  const costActual = budget
    .filter((b) => b.category !== 'revenue')
    .reduce((s, b) => s + Number(b.actual_vnd ?? 0), 0);
  const highRisks = risks.filter(
    (r) => r.risk_level === 'high' || r.risk_level === 'critical',
  ).length;
  let kpiAvg = 0;
  let kpiWithOwner = 0;
  if (kpis.length) {
    kpiAvg =
      Math.round(
        (kpis.reduce((s, k) => s + Number(k.achievement_pct ?? 0), 0) / kpis.length) * 10,
      ) / 10;
    kpiWithOwner = kpis.filter(
      (k) => Number(k.owner_staff_id ?? 0) > 0 || String(k.owner_name ?? '').trim(),
    ).length;
  }
  const inv = computeProductInventoryStats(products);
  const kpiBoard = computeKpiBoardStats(kpis);
  return {
    project: proj,
    product_count: products.length,
    products_available: products.filter((p) => p.status === 'available').length,
    products_sold: products.filter((p) => p.status === 'sold').length,
    product_lines_count: (inv.by_product_line as unknown[])?.length ?? 0,
    product_zones_count: (inv.by_zone as unknown[])?.length ?? 0,
    kpi_count: kpis.length,
    kpi_with_owner_count: kpiWithOwner,
    kpi_avg_achievement_pct: kpiAvg,
    kpi_weight_total_pct: kpiBoard.weight_total_pct ?? 0,
    inventory: inv,
    kpi_board: kpiBoard,
    risk_count: risks.length,
    high_risk_count: highRisks,
    budget_revenue_planned_vnd: revPlanned,
    budget_revenue_actual_vnd: revActual,
    budget_cost_planned_vnd: costPlanned,
    budget_cost_actual_vnd: costActual,
    profit_planned_vnd: revPlanned - costPlanned,
    profit_actual_vnd: revActual - costActual,
  };
}
