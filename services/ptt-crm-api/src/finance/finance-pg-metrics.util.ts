import { Pool } from 'pg';
import {
  buildFinanceKpiAlerts,
  THRESHOLD_DEFAULTS,
  THRESHOLD_ENV_KEYS,
} from './finance-kpi.util';
import {
  ATTRIBUTION_DRILL_DEFAULT,
  buildExecutiveWeekBuckets,
  EXECUTIVE_WEEKLY_DEFAULT,
  resolveExecutiveAnchorYmd,
} from './business-dashboard.util';
import {
  AR_AGING_BUCKET_KEYS,
  AR_AGING_BUCKET_LABELS,
  BILLING_TYPE_ONE_OFF,
  BILLING_TYPE_RECURRING,
  COST_PHASE_PRESALES,
  parseYmd,
  resolvePaymentDueOn,
  todayYmd,
} from './finance-metrics.util';

const INT_THRESHOLD_KEYS = new Set([
  'ontime_min_decided',
  'customer_churn_min_prev',
  'close_rate_min_qualified',
  'ar_overdue_critical_vnd',
]);

function envNumber(name: string, defaultVal: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return defaultVal;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultVal;
}

function monthPrefix(year: number, month: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

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

function agingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'not_due';
  if (daysOverdue <= 30) return '1_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  return 'over_90';
}

function pctMargin(revenue: number, cost: number): number {
  if (revenue <= 0) return 0;
  return Math.round(((revenue - cost) / revenue) * 10000) / 100;
}

function formatVndShort(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('vi-VN')} ₫`;
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS ok`,
    [name],
  );
  return Boolean(result.rows[0]?.ok);
}

async function lifecycleArTotals(
  pool: Pool,
  lifecycleId: number,
): Promise<[number, number]> {
  const result = await pool.query(
    `SELECT amount_vnd, due_on, received_on, status
     FROM crm_svc_payments
     WHERE lifecycle_id = $1 AND status = 'pending'`,
    [lifecycleId],
  );
  const asOf = todayYmd();
  let pending = 0;
  let overdue = 0;
  for (const row of result.rows as Array<Record<string, unknown>>) {
    const amount = Number(row.amount_vnd ?? 0);
    pending += amount;
    const dueIso = resolvePaymentDueOn(row);
    const due = parseYmd(dueIso);
    if (due && due < asOf) overdue += amount;
  }
  return [pending, overdue];
}

export async function getSummary(
  pool: Pool,
  lifecycleId: number,
  contractAmountVnd: number,
): Promise<Record<string, unknown>> {
  const payResult = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'received' THEN amount_vnd ELSE 0 END), 0)::bigint AS received_revenue,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_vnd ELSE 0 END), 0)::bigint AS pending_revenue
     FROM crm_svc_payments WHERE lifecycle_id = $1`,
    [lifecycleId],
  );
  const deliveryResult = await pool.query(
    `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS total
     FROM crm_svc_expenses
     WHERE lifecycle_id = $1
       AND COALESCE(NULLIF(cost_phase, ''), 'delivery') = 'delivery'`,
    [lifecycleId],
  );
  const presalesResult = await pool.query(
    `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS total
     FROM crm_svc_expenses WHERE lifecycle_id = $1 AND cost_phase = 'presales'`,
    [lifecycleId],
  );

  const received = Number(payResult.rows[0]?.received_revenue ?? 0);
  const pending = Number(payResult.rows[0]?.pending_revenue ?? 0);
  const deliveryExpenses = Number(deliveryResult.rows[0]?.total ?? 0);
  const presalesExpenses = Number(presalesResult.rows[0]?.total ?? 0);
  const totalExpenses = deliveryExpenses + presalesExpenses;
  const profit = received - deliveryExpenses;
  const marginPct = received > 0 ? Math.round((profit / received) * 10000) / 100 : 0;
  const outstanding = contractAmountVnd - received;
  const [arPending, arOverdue] = await lifecycleArTotals(pool, lifecycleId);

  return {
    expected_revenue: contractAmountVnd,
    received_revenue: received,
    pending_revenue: pending,
    ar_pending_vnd: arPending,
    ar_overdue_vnd: arOverdue,
    delivery_expenses: deliveryExpenses,
    presales_expenses: presalesExpenses,
    total_expenses: totalExpenses,
    profit,
    margin_pct: marginPct,
    outstanding,
  };
}

function emptyArAging(asOf: string, amId: number | null): Record<string, unknown> {
  const buckets: Record<string, number> = {};
  for (const key of AR_AGING_BUCKET_KEYS) buckets[key] = 0;
  return {
    as_of: asOf,
    am_id: amId,
    total_pending_vnd: 0,
    total_overdue_vnd: 0,
    buckets,
    bucket_labels: AR_AGING_BUCKET_LABELS,
    items: [],
  };
}

export async function getArAging(
  pool: Pool,
  opts: { asOf?: string | null; amId?: number | null } = {},
): Promise<Record<string, unknown>> {
  const asOfIso = parseYmd(opts.asOf ?? '') ?? todayYmd();
  const asOfDate = new Date(asOfIso + 'T00:00:00');
  if (!(await tableExists(pool, 'crm_svc_payments')) || !(await tableExists(pool, 'crm_service_lifecycle'))) {
    return emptyArAging(asOfIso, opts.amId ?? null);
  }

  const params: unknown[] = [];
  const where = ["p.status = 'pending'"];
  if (opts.amId != null) {
    params.push(opts.amId);
    where.push(`lc.assigned_am = $${params.length}`);
  }

  const result = await pool.query(
    `
    SELECT p.id, p.lifecycle_id, p.amount_vnd, p.received_on, p.due_on, p.status,
           p.notes, lc.assigned_am, lc.service_slug, lc.customer_id,
           cu.name AS customer_name,
           COALESCE(ct.billing_type, '${BILLING_TYPE_ONE_OFF}') AS billing_type
    FROM crm_svc_payments p
    INNER JOIN crm_service_lifecycle lc ON lc.id = p.lifecycle_id
    LEFT JOIN crm_customers cu ON cu.id = lc.customer_id
    LEFT JOIN crm_contracts ct ON ct.id = lc.contract_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.due_on ASC NULLS LAST, p.id ASC
    `,
    params,
  );

  const buckets: Record<string, number> = {};
  for (const key of AR_AGING_BUCKET_KEYS) buckets[key] = 0;
  const items: Record<string, unknown>[] = [];
  let totalPending = 0;
  let totalOverdue = 0;

  for (const d of result.rows as Array<Record<string, unknown>>) {
    const amount = Number(d.amount_vnd ?? 0);
    const dueIso = resolvePaymentDueOn(d);
    const due = parseYmd(dueIso);
    let daysOverdue = 0;
    let bucket = 'not_due';
    if (due) {
      daysOverdue = Math.floor((asOfDate.getTime() - new Date(due + 'T00:00:00').getTime()) / 86400000);
      bucket = agingBucket(daysOverdue);
    }
    buckets[bucket] = (buckets[bucket] ?? 0) + amount;
    totalPending += amount;
    if (daysOverdue > 0) totalOverdue += amount;
    items.push({
      payment_id: Number(d.id),
      lifecycle_id: Number(d.lifecycle_id),
      amount_vnd: amount,
      due_on: dueIso,
      days_overdue: Math.max(0, daysOverdue),
      bucket,
      customer_name: d.customer_name ?? '—',
      service_slug: d.service_slug ?? '',
      billing_type: String(d.billing_type ?? BILLING_TYPE_ONE_OFF),
      assigned_am: d.assigned_am,
      notes: d.notes ?? '',
    });
  }

  return {
    as_of: asOfIso,
    am_id: opts.amId ?? null,
    total_pending_vnd: totalPending,
    total_overdue_vnd: totalOverdue,
    buckets,
    bucket_labels: AR_AGING_BUCKET_LABELS,
    items,
  };
}

export async function getRecurringRevenueSummary(
  pool: Pool,
  year: number,
  month: number,
  amId?: number | null,
): Promise<Record<string, unknown>> {
  const monthStr = monthPrefix(year, month);
  if (!(await tableExists(pool, 'crm_svc_payments')) || !(await tableExists(pool, 'crm_service_lifecycle'))) {
    return {
      year,
      month,
      am_id: amId ?? null,
      received_recurring_vnd: 0,
      pending_recurring_vnd: 0,
      active_recurring_contracts: 0,
    };
  }

  const amParams: unknown[] = [BILLING_TYPE_RECURRING];
  let amClause = '';
  if (amId != null) {
    amParams.push(amId);
    amClause = ` AND lc.assigned_am = $${amParams.length}`;
  }

  const recvResult = await pool.query(
    `
    SELECT COALESCE(SUM(p.amount_vnd), 0)::bigint AS v
    FROM crm_svc_payments p
    INNER JOIN crm_service_lifecycle lc ON lc.id = p.lifecycle_id
    INNER JOIN crm_contracts ct ON ct.id = lc.contract_id
    WHERE ct.billing_type = $1
      AND p.status = 'received'
      AND to_char(p.received_on, 'YYYY-MM') = $2
      ${amClause}
    `,
    [...amParams, monthStr],
  );

  const pendingResult = await pool.query(
    `
    SELECT COALESCE(SUM(p.amount_vnd), 0)::bigint AS v
    FROM crm_svc_payments p
    INNER JOIN crm_service_lifecycle lc ON lc.id = p.lifecycle_id
    INNER JOIN crm_contracts ct ON ct.id = lc.contract_id
    WHERE ct.billing_type = $1 AND p.status = 'pending' ${amClause}
    `,
    amParams,
  );

  const activeResult = await pool.query(
    `
    SELECT COUNT(DISTINCT ct.id)::bigint AS v
    FROM crm_contracts ct
    INNER JOIN crm_service_lifecycle lc ON lc.contract_id = ct.id
    WHERE ct.billing_type = $1
      AND ct.status IN ('active', 'signed', 'expiring')
      AND lc.status = 'active'
      ${amClause}
    `,
    amParams,
  );

  return {
    year,
    month,
    am_id: amId ?? null,
    received_recurring_vnd: Number(recvResult.rows[0]?.v ?? 0),
    pending_recurring_vnd: Number(pendingResult.rows[0]?.v ?? 0),
    active_recurring_contracts: Number(activeResult.rows[0]?.v ?? 0),
  };
}

function emptyPackageBucket(): Record<string, unknown> {
  return {
    lifecycle_count: 0,
    expected_revenue_vnd: 0,
    received_month_vnd: 0,
    delivery_expenses_month_vnd: 0,
    gross_margin_month_pct: 0,
    received_lifetime_vnd: 0,
    delivery_expenses_lifetime_vnd: 0,
    gross_margin_lifetime_pct: 0,
    profit_lifetime_vnd: 0,
    ar_overdue_vnd: 0,
    outstanding_vnd: 0,
  };
}

export async function getServicePackageRollup(
  pool: Pool,
  year: number,
  month: number,
  lifecycleStatus = 'active',
): Promise<Record<string, unknown>> {
  const monthStr = monthPrefix(year, month);
  if (!(await tableExists(pool, 'crm_service_lifecycle'))) {
    return { year, month, packages: [] as Record<string, unknown>[] };
  }

  const lcResult = await pool.query(
    `SELECT lc.id, lc.service_slug, lc.contract_id
     FROM crm_service_lifecycle lc
     WHERE lc.status = $1
     ORDER BY lc.service_slug, lc.id`,
    [lifecycleStatus],
  );

  const packages: Record<string, Record<string, unknown>> = {};
  for (const lc of lcResult.rows as Array<Record<string, unknown>>) {
    const slug = String(lc.service_slug ?? '').trim() || '_unknown';
    if (!packages[slug]) {
      packages[slug] = { ...emptyPackageBucket(), service_slug: slug, service_label: slug };
    }
    const bucket = packages[slug]!;
    const lcId = Number(lc.id);
    let contractAmount = 0;
    if (lc.contract_id) {
      const cResult = await pool.query(`SELECT amount_vnd FROM crm_contracts WHERE id = $1`, [
        Number(lc.contract_id),
      ]);
      contractAmount = Number(cResult.rows[0]?.amount_vnd ?? 0);
    }
    const summary = await getSummary(pool, lcId, contractAmount);
    bucket.lifecycle_count = Number(bucket.lifecycle_count) + 1;
    bucket.expected_revenue_vnd = Number(bucket.expected_revenue_vnd) + contractAmount;
    bucket.received_lifetime_vnd = Number(bucket.received_lifetime_vnd) + Number(summary.received_revenue);
    bucket.delivery_expenses_lifetime_vnd =
      Number(bucket.delivery_expenses_lifetime_vnd) + Number(summary.delivery_expenses);
    bucket.profit_lifetime_vnd = Number(bucket.profit_lifetime_vnd) + Number(summary.profit);
    bucket.ar_overdue_vnd = Number(bucket.ar_overdue_vnd) + Number(summary.ar_overdue_vnd);
    bucket.outstanding_vnd = Number(bucket.outstanding_vnd) + Number(summary.outstanding);

    const recvMonth = await pool.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
       FROM crm_svc_payments
       WHERE lifecycle_id = $1 AND status = 'received' AND to_char(received_on, 'YYYY-MM') = $2`,
      [lcId, monthStr],
    );
    bucket.received_month_vnd = Number(bucket.received_month_vnd) + Number(recvMonth.rows[0]?.v ?? 0);

    const expMonth = await pool.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
       FROM crm_svc_expenses
       WHERE lifecycle_id = $1
         AND COALESCE(NULLIF(cost_phase, ''), 'delivery') = 'delivery'
         AND to_char(expense_on, 'YYYY-MM') = $2`,
      [lcId, monthStr],
    );
    bucket.delivery_expenses_month_vnd =
      Number(bucket.delivery_expenses_month_vnd) + Number(expMonth.rows[0]?.v ?? 0);
  }

  const pkgList = Object.values(packages).map((p) => {
    p.gross_margin_month_pct = pctMargin(
      Number(p.received_month_vnd),
      Number(p.delivery_expenses_month_vnd),
    );
    p.gross_margin_lifetime_pct = pctMargin(
      Number(p.received_lifetime_vnd),
      Number(p.delivery_expenses_lifetime_vnd),
    );
    return p;
  });

  return { year, month, packages: pkgList };
}

function emptyLeadKpi(year: number, month: number, staffId: number | null): Record<string, unknown> {
  return {
    year,
    month,
    staff_id: staffId,
    qualified_in_month: 0,
    won_from_month_cohort: 0,
    cohort_close_rate_pct: 0,
    cohort_close_rate_decided_pct: 0,
    qualified_leads: 0,
    close_rate_pct: 0,
  };
}

export async function getLeadKpiSummary(
  pool: Pool,
  year: number,
  month: number,
  staffId?: number | null,
): Promise<Record<string, unknown>> {
  const monthStr = monthPrefix(year, month);
  if (!(await tableExists(pool, 'crm_leads'))) {
    return emptyLeadKpi(year, month, staffId ?? null);
  }

  const params: unknown[] = [monthStr];
  let staffClause = '';
  if (staffId != null) {
    params.push(staffId);
    staffClause = ` AND assigned_staff_id = $${params.length}`;
  }

  const qualifiedResult = await pool.query(
    `SELECT COUNT(*)::bigint AS v FROM crm_leads
     WHERE status = 'qualified' AND to_char(created_at, 'YYYY-MM') = $1${staffClause}`,
    params,
  );
  const wonResult = await pool.query(
    `SELECT COUNT(*)::bigint AS v FROM crm_leads
     WHERE status = 'won' AND to_char(updated_at, 'YYYY-MM') = $1${staffClause}`,
    params,
  );

  const qualified = Number(qualifiedResult.rows[0]?.v ?? 0);
  const won = Number(wonResult.rows[0]?.v ?? 0);
  const closeRate = qualified > 0 ? Math.round((won / qualified) * 10000) / 100 : 0;

  return {
    year,
    month,
    staff_id: staffId ?? null,
    qualified_in_month: qualified,
    won_from_month_cohort: won,
    cohort_close_rate_pct: closeRate,
    cohort_close_rate_decided_pct: closeRate,
    qualified_leads: qualified,
    close_rate_pct: closeRate,
  };
}

export async function getMarketingSpendVnd(
  pool: Pool,
  year: number,
  month: number,
): Promise<[number, string]> {
  try {
    const result = await pool.query(
      `SELECT marketing_spend_vnd FROM crm_finance_period_inputs WHERE year = $1 AND month = $2`,
      [year, month],
    );
    if (result.rows[0]) {
      return [Number(result.rows[0].marketing_spend_vnd ?? 0), 'db'];
    }
  } catch {
    /* table may not exist yet */
  }
  const envRaw = String(process.env.PTT_MONTHLY_MARKETING_SPEND_VND ?? '').trim();
  const envVal = envRaw ? Math.max(0, Number(envRaw) || 0) : 0;
  return [envVal, envRaw ? 'env' : 'default'];
}

export async function setMarketingSpendVnd(
  pool: Pool,
  year: number,
  month: number,
  amountVnd: number,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO crm_finance_period_inputs (year, month, marketing_spend_vnd, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (year, month) DO UPDATE SET
      marketing_spend_vnd = EXCLUDED.marketing_spend_vnd,
      updated_at = NOW()
    `,
    [year, month, amountVnd],
  );
}

export async function getCacMetrics(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  const monthStr = monthPrefix(year, month);
  let presalesCost = 0;
  if (await tableExists(pool, 'crm_svc_expenses')) {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
       FROM crm_svc_expenses
       WHERE cost_phase = $1 AND to_char(expense_on, 'YYYY-MM') = $2`,
      [COST_PHASE_PRESALES, monthStr],
    );
    presalesCost = Number(result.rows[0]?.v ?? 0);
  }
  const [marketingCost, marketingSource] = await getMarketingSpendVnd(pool, year, month);

  let newCustomers = 0;
  if (await tableExists(pool, 'crm_customers')) {
    const result = await pool.query(
      `SELECT COUNT(*)::bigint AS v FROM crm_customers WHERE to_char(created_at, 'YYYY-MM') = $1`,
      [monthStr],
    );
    newCustomers = Number(result.rows[0]?.v ?? 0);
  }

  const totalCost = presalesCost + marketingCost;
  const cac = newCustomers > 0 ? Math.round(totalCost / newCustomers) : 0;

  return {
    year,
    month,
    cac_vnd: cac,
    new_customers: newCustomers,
    presales_cost_vnd: presalesCost,
    marketing_cost_vnd: marketingCost,
    marketing_spend_source: marketingSource,
  };
}

export async function getMrrArrMetrics(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  const rec = await getRecurringRevenueSummary(pool, year, month);
  const mrr = Number(rec.received_recurring_vnd ?? 0);
  return {
    year,
    month,
    mrr_bookings_vnd: mrr,
    mrr_cash_vnd: mrr,
    arr_bookings_vnd: mrr * 12,
  };
}

export async function getConcentrationMetrics(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  const monthStr = monthPrefix(year, month);
  if (!(await tableExists(pool, 'crm_svc_payments')) || !(await tableExists(pool, 'crm_service_lifecycle'))) {
    return {
      year,
      month,
      total_received_vnd: 0,
      top1_share_pct: 0,
      top2_concentration_pct: 0,
      top_customers: [] as Record<string, unknown>[],
    };
  }

  const result = await pool.query(
    `
    SELECT cu.id AS customer_id, cu.name AS customer_name, COALESCE(SUM(p.amount_vnd), 0)::bigint AS received_vnd
    FROM crm_svc_payments p
    INNER JOIN crm_service_lifecycle lc ON lc.id = p.lifecycle_id
    LEFT JOIN crm_customers cu ON cu.id = lc.customer_id
    WHERE p.status = 'received' AND to_char(p.received_on, 'YYYY-MM') = $1
    GROUP BY cu.id, cu.name
    ORDER BY received_vnd DESC
    `,
    [monthStr],
  );

  const rows = result.rows as Array<Record<string, unknown>>;
  const total = rows.reduce((s, r) => s + Number(r.received_vnd ?? 0), 0);
  const topCustomers = rows.slice(0, 5).map((r) => ({
    customer_id: r.customer_id,
    customer_name: r.customer_name ?? '—',
    received_vnd: Number(r.received_vnd ?? 0),
    share_pct: total > 0 ? Math.round((Number(r.received_vnd ?? 0) / total) * 10000) / 100 : 0,
  }));

  const top1 = topCustomers[0]?.share_pct ?? 0;
  const top2 =
    topCustomers.length >= 2
      ? Math.round(
          ((Number(topCustomers[0]?.received_vnd ?? 0) + Number(topCustomers[1]?.received_vnd ?? 0)) /
            (total || 1)) *
            10000,
        ) / 100
      : top1;

  return {
    year,
    month,
    total_received_vnd: total,
    top1_share_pct: top1,
    top2_concentration_pct: top2,
    top_customers: topCustomers,
  };
}

export async function getPortfolioMetrics(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  const concentration = await getConcentrationMetrics(pool, year, month);
  const capacity = {
    year,
    month,
    am_utilization_pct: 0,
    sp_utilization_pct: 0,
    combined_utilization_pct: 0,
  };
  return { year, month, concentration, capacity };
}

export async function getRetentionMetrics(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  let active = 0;
  let activePrev = 0;
  if (await tableExists(pool, 'crm_service_lifecycle')) {
    const result = await pool.query(
      `SELECT COUNT(DISTINCT customer_id)::bigint AS v FROM crm_service_lifecycle WHERE status = 'active'`,
    );
    active = Number(result.rows[0]?.v ?? 0);
    activePrev = active;
  }
  const retentionPct = activePrev > 0 ? Math.round((active / activePrev) * 10000) / 100 : 100;
  const churnPct = Math.max(0, 100 - retentionPct);
  return {
    year,
    month,
    active_customers: active,
    active_customers_prev: activePrev,
    customer_retention_pct: retentionPct,
    customer_churn_pct: churnPct,
    renewal_cohort: {
      contracts_ending: 0,
      renewed: 0,
      churned: 0,
      contracts_decided: 0,
      renewal_rate_pct: 0,
    },
  };
}

export async function getExecMetrics(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  return {
    year,
    month,
    cac: await getCacMetrics(pool, year, month),
    mrr_arr: await getMrrArrMetrics(pool, year, month),
    delivery_ontime: {
      year,
      month,
      on_time_rate_pct: 0,
      tasks_on_time: 0,
      tasks_decided: 0,
    },
  };
}

export async function getFinancialLifecycleRows(pool: Pool): Promise<Record<string, unknown>[]> {
  if (!(await tableExists(pool, 'crm_service_lifecycle'))) return [];
  const lcResult = await pool.query(
    `
    SELECT lc.id, lc.service_slug, lc.stage, lc.contract_id, lc.customer_id,
           cu.name AS customer_name
    FROM crm_service_lifecycle lc
    LEFT JOIN crm_customers cu ON cu.id = lc.customer_id
    WHERE lc.status = 'active'
    ORDER BY lc.id
    `,
  );

  const rows: Record<string, unknown>[] = [];
  for (const lc of lcResult.rows as Array<Record<string, unknown>>) {
    let contractAmount = 0;
    if (lc.contract_id) {
      const cResult = await pool.query(`SELECT amount_vnd FROM crm_contracts WHERE id = $1`, [
        Number(lc.contract_id),
      ]);
      contractAmount = Number(cResult.rows[0]?.amount_vnd ?? 0);
    }
    const summary = await getSummary(pool, Number(lc.id), contractAmount);
    rows.push({
      lifecycle_id: lc.id,
      service_slug: lc.service_slug,
      service_label: lc.service_slug,
      stage: lc.stage,
      customer_name: lc.customer_name ?? '—',
      ...summary,
    });
  }
  rows.sort((a, b) => Number(a.margin_pct) - Number(b.margin_pct));
  return rows;
}

export async function loadFinanceKpiBundle(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  return {
    year,
    month,
    ar_aging: await getArAging(pool),
    recurring_summary: await getRecurringRevenueSummary(pool, year, month),
    package_rollup: await getServicePackageRollup(pool, year, month),
    retention_metrics: await getRetentionMetrics(pool, year, month),
    lead_kpi: await getLeadKpiSummary(pool, year, month),
    portfolio_metrics: await getPortfolioMetrics(pool, year, month),
    exec_metrics: await getExecMetrics(pool, year, month),
  };
}

export async function getAlertThresholds(pool: Pool): Promise<Record<string, number>> {
  let dbMap: Record<string, unknown> = {};
  try {
    const result = await pool.query(
      `SELECT thresholds_json FROM crm_finance_kpi_config WHERE config_key = 'global' LIMIT 1`,
    );
    const raw = result.rows[0]?.thresholds_json;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      dbMap = raw as Record<string, unknown>;
    }
  } catch {
    /* table may not exist yet */
  }

  const out: Record<string, number> = {};
  for (const [key, defaultVal] of Object.entries(THRESHOLD_DEFAULTS)) {
    if (key in dbMap) {
      const raw = String(dbMap[key]).trim();
      const parsed = INT_THRESHOLD_KEYS.has(key) ? parseInt(raw, 10) : parseFloat(raw);
      if (Number.isFinite(parsed)) {
        out[key] = parsed;
        continue;
      }
    }
    const envKey = THRESHOLD_ENV_KEYS[key];
    out[key] = envKey ? envNumber(envKey, defaultVal) : defaultVal;
  }
  return out;
}

export async function setAlertThresholds(
  pool: Pool,
  updates: Record<string, unknown>,
): Promise<Record<string, number>> {
  const current = await getAlertThresholds(pool);
  const merged: Record<string, number> = { ...current };
  for (const [key, value] of Object.entries(updates)) {
    if (!(key in THRESHOLD_DEFAULTS)) continue;
    merged[key] = INT_THRESHOLD_KEYS.has(key)
      ? Math.max(0, Math.trunc(Number(value)))
      : Number(value);
  }
  await pool.query(
    `
    INSERT INTO crm_finance_kpi_config (config_key, thresholds_json, updated_at)
    VALUES ('global', $1::jsonb, NOW())
    ON CONFLICT (config_key) DO UPDATE SET
      thresholds_json = EXCLUDED.thresholds_json,
      updated_at = NOW()
    `,
    [JSON.stringify(merged)],
  );
  return getAlertThresholds(pool);
}

export async function collectFinanceKpiAlerts(
  pool: Pool,
  year: number,
  month: number,
  bundle?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const data = bundle ?? (await loadFinanceKpiBundle(pool, year, month));
  const thresholds = await getAlertThresholds(pool);
  return buildFinanceKpiAlerts(year, month, data, thresholds);
}

export async function getFinanceKpiTrends(
  pool: Pool,
  year: number,
  month: number,
  months = 6,
): Promise<Record<string, unknown>> {
  const count = Math.max(2, Math.min(months, 12));
  const points = monthPoints(year, month, count);
  const labels: string[] = [];
  const mrrSeries: number[] = [];
  const concSeries: number[] = [];
  const cacSeries: number[] = [];

  for (const [y, m] of points) {
    labels.push(`${String(m).padStart(2, '0')}/${y}`);
    const mrr = await getMrrArrMetrics(pool, y, m);
    const conc = await getConcentrationMetrics(pool, y, m);
    const cac = await getCacMetrics(pool, y, m);
    mrrSeries.push(Number(mrr.mrr_bookings_vnd ?? 0));
    concSeries.push(Number(conc.top2_concentration_pct ?? 0));
    cacSeries.push(Number(cac.cac_vnd ?? 0));
  }

  return {
    year,
    month,
    months: count,
    labels,
    mrr_bookings_vnd: mrrSeries,
    top2_concentration_pct: concSeries,
    cac_vnd: cacSeries,
  };
}

async function aggregateMonthRevenueCost(
  pool: Pool,
  year: number,
  month: number,
): Promise<{ revenue_vnd: number; cost_vnd: number }> {
  const monthStr = monthPrefix(year, month);
  let revenue = 0;
  let cost = 0;

  if (await tableExists(pool, 'crm_svc_payments')) {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
       FROM crm_svc_payments
       WHERE status = 'received' AND to_char(received_on, 'YYYY-MM') = $1`,
      [monthStr],
    );
    revenue = Number(result.rows[0]?.v ?? 0);
  }

  if (await tableExists(pool, 'crm_svc_expenses')) {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
       FROM crm_svc_expenses
       WHERE COALESCE(NULLIF(cost_phase, ''), 'delivery') = 'delivery'
         AND to_char(expense_on, 'YYYY-MM') = $1`,
      [monthStr],
    );
    cost = Number(result.rows[0]?.v ?? 0);
  }

  return { revenue_vnd: revenue, cost_vnd: cost };
}

export async function getFinancialIntelligence(
  pool: Pool,
  year: number,
  month: number,
  months = 6,
): Promise<Record<string, unknown>> {
  const count = Math.max(2, Math.min(months, 12));
  const thresholds = await getAlertThresholds(pool);
  const marginThreshold = Number(thresholds.low_margin_warn_pct ?? 20);
  const rows = await getFinancialLifecycleRows(pool);
  const arAging = await getArAging(pool);

  const currentMonth = await aggregateMonthRevenueCost(pool, year, month);
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
    const point = await aggregateMonthRevenueCost(pool, y, m);
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

async function sumReceivedRevenue(pool: Pool, start: string, end: string): Promise<number> {
  if (!(await tableExists(pool, 'crm_svc_payments'))) return 0;
  const result = await pool.query(
    `
    SELECT COALESCE(SUM(amount_vnd), 0)::bigint AS v
    FROM crm_svc_payments
    WHERE status = 'received'
      AND received_on >= $1::date
      AND received_on <= $2::date
    `,
    [start, end],
  );
  return Number(result.rows[0]?.v ?? 0);
}

async function countLeadsCreated(pool: Pool, start: string, end: string): Promise<number> {
  if (!(await tableExists(pool, 'crm_leads'))) return 0;
  const result = await pool.query(
    `
    SELECT COUNT(*)::bigint AS v
    FROM crm_leads
    WHERE COALESCE(is_duplicate, false) = false
      AND created_at::date >= $1::date
      AND created_at::date <= $2::date
    `,
    [start, end],
  );
  return Number(result.rows[0]?.v ?? 0);
}

async function getExecutiveWeeklyTrends(
  pool: Pool,
  year: number,
  month: number,
  weeks = EXECUTIVE_WEEKLY_DEFAULT,
): Promise<Record<string, unknown>> {
  const anchor = resolveExecutiveAnchorYmd(year, month);
  const buckets = buildExecutiveWeekBuckets(anchor, weeks);
  const filled = await Promise.all(
    buckets.map(async (bucket) => ({
      ...bucket,
      revenue_vnd: await sumReceivedRevenue(pool, bucket.start, bucket.end),
      leads: await countLeadsCreated(pool, bucket.start, bucket.end),
    })),
  );

  return {
    weeks: filled.length,
    anchor,
    labels: filled.map((b) => b.label),
    revenue_vnd: filled.map((b) => b.revenue_vnd),
    leads: filled.map((b) => b.leads),
    buckets: filled,
  };
}

function leadCampaignPgSql(): string {
  return `COALESCE(
    NULLIF(trim(utm_campaign), ''),
    NULLIF(trim(meta_json->>'campaign_id'), ''),
    NULLIF(trim(meta_json->>'facebook_campaign_id'), ''),
    NULLIF(trim(meta_json->>'utm_campaign'), '')
  )`;
}

async function getAttributionDrillPaths(
  pool: Pool,
  year: number,
  month: number,
  limit = ATTRIBUTION_DRILL_DEFAULT,
): Promise<Record<string, unknown>> {
  if (!(await tableExists(pool, 'crm_leads'))) {
    return { rows: [], count: 0 };
  }

  const monthStr = monthPrefix(year, month);
  const campaignExpr = leadCampaignPgSql();
  const maxRows = Math.max(1, Math.min(Math.trunc(limit), 10));

  const result = await pool.query(
    `
    SELECT
      ${campaignExpr} AS campaign_key,
      COUNT(*)::bigint AS lead_count,
      MAX(id) AS sample_lead_id
    FROM crm_leads
    WHERE COALESCE(is_duplicate, false) = false
      AND to_char(created_at, 'YYYY-MM') = $1
      AND ${campaignExpr} IS NOT NULL
      AND trim(${campaignExpr}) != ''
    GROUP BY campaign_key
    ORDER BY lead_count DESC, campaign_key ASC
    LIMIT $2
    `,
    [monthStr, maxRows],
  );

  const drillRows = await Promise.all(
    (result.rows as Array<Record<string, unknown>>).map(async (row) => {
      const campaignKey = String(row.campaign_key ?? '').trim();
      const sampleLeadId =
        row.sample_lead_id != null && Number.isFinite(Number(row.sample_lead_id))
          ? Number(row.sample_lead_id)
          : null;
      let sampleLeadName: string | null = null;
      if (sampleLeadId != null) {
        const leadResult = await pool.query(`SELECT full_name FROM crm_leads WHERE id = $1 LIMIT 1`, [
          sampleLeadId,
        ]);
        sampleLeadName = leadResult.rows[0]?.full_name
          ? String(leadResult.rows[0].full_name)
          : null;
      }
      const hubHref = `/crm/hub?campaign_id=${encodeURIComponent(campaignKey)}`;
      const leadHref = sampleLeadId != null ? `/crm/leads/${sampleLeadId}` : null;
      return {
        campaign_key: campaignKey,
        campaign_label: campaignKey,
        lead_count: Number(row.lead_count ?? 0),
        sample_lead_id: sampleLeadId,
        sample_lead_name: sampleLeadName,
        hub_href: hubHref,
        lead_href: leadHref,
      };
    }),
  );

  return {
    year,
    month,
    count: drillRows.length,
    rows: drillRows,
  };
}

export async function getBusinessDashboardExecutive(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  return {
    weekly_trends: await getExecutiveWeeklyTrends(pool, year, month, EXECUTIVE_WEEKLY_DEFAULT),
    attribution_drill: await getAttributionDrillPaths(pool, year, month, ATTRIBUTION_DRILL_DEFAULT),
  };
}

export async function getFinanceKpiInboxSummary(pool: Pool): Promise<Record<string, unknown>> {
  if (!(await tableExists(pool, 'crm_reminders'))) {
    return { pending_count: 0, critical_count: 0, warning_count: 0, items: [] };
  }

  const result = await pool.query(
    `
    SELECT id, title, body, remind_at, status, meta_json
    FROM crm_reminders
    WHERE scope = 'finance_kpi' AND reminder_kind = 'kpi_alert' AND status = 'pending'
    ORDER BY remind_at ASC NULLS LAST, id ASC
    LIMIT 100
    `,
  );

  const items: Record<string, unknown>[] = [];
  let critical = 0;
  let warning = 0;
  for (const d of result.rows as Array<Record<string, unknown>>) {
    let meta: Record<string, unknown> = {};
    const rawMeta = d.meta_json;
    if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
      meta = rawMeta as Record<string, unknown>;
    } else if (typeof rawMeta === 'string') {
      try {
        meta = JSON.parse(rawMeta) as Record<string, unknown>;
      } catch {
        meta = {};
      }
    }
    const level = String(meta.level ?? '');
    if (level === 'critical') critical += 1;
    else warning += 1;
    items.push({
      id: Number(d.id),
      title: d.title ?? '',
      body: d.body ?? '',
      remind_at: d.remind_at ?? '',
      level,
      dashboard_url: meta.dashboard_url ?? '',
      year: meta.year,
      month: meta.month,
    });
  }
  return { pending_count: items.length, critical_count: critical, warning_count: warning, items };
}

export async function syncFinanceKpiInboxStub(
  pool: Pool,
  year: number,
  month: number,
): Promise<Record<string, unknown>> {
  if (!(await tableExists(pool, 'crm_reminders'))) {
    return {
      year,
      month,
      period_ref: year * 100 + month,
      synced: 0,
      removed: 0,
      alert_count: 0,
      stub: true,
    };
  }
  const alerts = await collectFinanceKpiAlerts(pool, year, month);
  return {
    year,
    month,
    period_ref: year * 100 + month,
    synced: Number(alerts.alert_count ?? 0),
    removed: 0,
    alert_count: Number(alerts.alert_count ?? 0),
    stub: true,
  };
}
