import { DatabaseSync } from 'node:sqlite';
import { getAlertThresholds } from './finance-kpi.util';
import {
  deliveryPhaseSql,
  getArAging,
  getFinancialLifecycleRows,
  tableExists,
} from './finance-metrics.util';

function prevMonth(year: number, month: number): [number, number] {
  if (month === 1) return [year - 1, 12];
  return [year, month - 1];
}

function monthPoints(endYear: number, endMonth: number, count: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let y = endYear;
  let m = endMonth;
  for (let i = 0; i < Math.max(1, count); i++) {
    points.push([y, m]);
    [y, m] = prevMonth(y, m);
  }
  return points.reverse();
}

function aggregateMonthRevenueCost(
  db: DatabaseSync,
  year: number,
  month: number,
): { revenue_vnd: number; cost_vnd: number } {
  const monthPrefix = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  let revenue = 0;
  let cost = 0;

  if (tableExists(db, 'crm_svc_payments')) {
    const row = db
      .prepare(
        "SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_payments WHERE status = 'received' AND received_on LIKE ?",
      )
      .get(`${monthPrefix}%`) as Record<string, unknown> | undefined;
    revenue = Number(row?.v ?? 0);
  }

  if (tableExists(db, 'crm_svc_expenses')) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_expenses WHERE ${deliveryPhaseSql()} AND expense_on LIKE ?`,
      )
      .get(`${monthPrefix}%`) as Record<string, unknown> | undefined;
    cost = Number(row?.v ?? 0);
  }

  return { revenue_vnd: revenue, cost_vnd: cost };
}

export function getFinancialIntelligence(
  db: DatabaseSync,
  year: number,
  month: number,
  months = 6,
): Record<string, unknown> {
  const count = Math.max(2, Math.min(months, 12));
  const thresholds = getAlertThresholds(db);
  const marginThreshold = Number(thresholds.low_margin_warn_pct ?? 20);
  const rows = getFinancialLifecycleRows(db);
  const arAging = getArAging(db);

  const currentMonth = aggregateMonthRevenueCost(db, year, month);
  let lifetimeRevenue = 0;
  let lifetimeCost = 0;
  let lifetimeProfit = 0;
  const marginAtRiskRows: Record<string, unknown>[] = [];

  for (const row of rows) {
    const received = Number(row.received_revenue ?? 0);
    const expenses = Number(row.total_expenses ?? 0);
    const marginPct = Number(row.margin_pct ?? 0);
    lifetimeRevenue += received;
    lifetimeCost += expenses;
    lifetimeProfit += Number(row.profit ?? received - Number(row.delivery_expenses ?? 0));

    if (received > 0 && Number.isFinite(marginPct) && marginPct < marginThreshold) {
      marginAtRiskRows.push(row);
    }
  }

  const monthlyBurn = currentMonth.cost_vnd;
  const runwayMonths =
    monthlyBurn > 0 && lifetimeProfit > 0
      ? Math.round((lifetimeProfit / monthlyBurn) * 10) / 10
      : null;

  const revenueAtRisk = marginAtRiskRows.reduce(
    (sum, row) => sum + Number(row.received_revenue ?? 0),
    0,
  );
  const profitAtRisk = marginAtRiskRows.reduce((sum, row) => sum + Number(row.profit ?? 0), 0);

  const labels: string[] = [];
  const revenueSeries: number[] = [];
  const costSeries: number[] = [];
  for (const [y, m] of monthPoints(year, month, count)) {
    labels.push(`${String(m).padStart(2, '0')}/${y}`);
    const point = aggregateMonthRevenueCost(db, y, m);
    revenueSeries.push(point.revenue_vnd);
    costSeries.push(point.cost_vnd);
  }

  const actions: Record<string, unknown>[] = [];

  for (const row of marginAtRiskRows) {
    const lifecycleId = Number(row.lifecycle_id ?? 0);
    const marginPct = Number(row.margin_pct ?? 0);
    actions.push({
      id: `margin_${lifecycleId}`,
      kind: 'margin',
      level: marginPct < marginThreshold / 2 ? 'critical' : 'warning',
      title: 'Margin thấp',
      message: `${row.customer_name ?? 'KH'} · ${row.service_label ?? row.service_slug ?? 'lifecycle'}: ${marginPct.toFixed(1)}% (ngưỡng ${marginThreshold}%)`,
      lifecycle_id: lifecycleId,
      href: lifecycleId ? `/crm/service-delivery/${lifecycleId}` : '/crm/financials',
    });
  }

  const arItems = (arAging.items ?? []) as Array<Record<string, unknown>>;
  for (const item of arItems) {
    const days = Number(item.days_overdue ?? 0);
    if (days <= 30) continue;
    const lifecycleId = Number(item.lifecycle_id ?? 0);
    actions.push({
      id: `ar_${item.payment_id ?? lifecycleId}_${days}`,
      kind: 'ar',
      level: days > 60 ? 'critical' : 'warning',
      title: 'AR quá hạn >30 ngày',
      message: `${item.customer_name ?? 'KH'} · ${formatVndShort(Number(item.amount_vnd ?? 0))} · ${days} ngày`,
      lifecycle_id: lifecycleId,
      href: lifecycleId ? `/crm/service-delivery/${lifecycleId}` : '/crm/hub',
    });
  }

  actions.sort((a, b) => {
    const rank = (level: unknown) => (String(level) === 'critical' ? 0 : 1);
    return rank(a.level) - rank(b.level);
  });

  return {
    year,
    month,
    months: count,
    margin_threshold_pct: marginThreshold,
    burn_rate: {
      monthly_burn_vnd: monthlyBurn,
      monthly_revenue_vnd: currentMonth.revenue_vnd,
      lifetime_profit_vnd: lifetimeProfit,
      runway_months: runwayMonths,
      active_lifecycle_count: rows.length,
    },
    margin_at_risk: {
      threshold_pct: marginThreshold,
      count: marginAtRiskRows.length,
      revenue_vnd: revenueAtRisk,
      profit_vnd: profitAtRisk,
    },
    trends: {
      labels,
      revenue_vnd: revenueSeries,
      cost_vnd: costSeries,
    },
    actions,
    action_count: actions.length,
  };
}

function formatVndShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('vi-VN')} ₫`;
}
