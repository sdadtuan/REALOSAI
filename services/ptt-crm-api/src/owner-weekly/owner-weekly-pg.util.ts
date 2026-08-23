import { Pool } from 'pg';
import { getArAging } from '../finance/finance-pg-metrics.util';
import { COST_PHASE_DELIVERY, COST_PHASE_PRESALES, parseYmd } from '../finance/finance-metrics.util';
import {
  BLOCK_KEYS,
  BLOCK_LABELS,
  OWNER_WEEKLY_ENV_KEYS,
  OWNER_WEEKLY_TARGET_DEFAULTS,
  POSITION_SOURCE_LEDGER,
  POSITION_SOURCE_PROXY,
  RAG_GREEN,
  RAG_LABELS,
  RAG_RED,
  RAG_YELLOW,
  resolveWeekBounds,
} from './owner-weekly.util';

const CASH_SOURCE_MANUAL = 'manual';
const CASH_SOURCES = new Set(['manual', 'bank']);

function envNumber(name: string, defaultVal: number): number {
  const raw = String(process.env[name] ?? '').trim();
  if (!raw) return defaultVal;
  const n = Number(raw);
  return Number.isFinite(n) ? n : defaultVal;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDdMm(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

async function tableExists(pool: Pool, name: string): Promise<boolean> {
  const result = await pool.query(`SELECT to_regclass($1) AS reg`, [`public.${name}`]);
  return (result.rows[0] as { reg?: unknown })?.reg != null;
}

async function sumReceivedBetween(pool: Pool, start: string, end: string): Promise<number> {
  if (start > end || !(await tableExists(pool, 'crm_svc_payments'))) return 0;
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_payments
     WHERE status = 'received'
       AND substr(received_on::text, 1, 10) >= $1
       AND substr(received_on::text, 1, 10) <= $2`,
    [start, end],
  );
  return Number((result.rows[0] as { v?: unknown })?.v ?? 0);
}

async function sumExpensesBetween(
  pool: Pool,
  start: string,
  end: string,
  phase?: string,
): Promise<number> {
  if (start > end || !(await tableExists(pool, 'crm_svc_expenses'))) return 0;
  if (phase) {
    const result = await pool.query(
      `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_expenses
       WHERE substr(expense_on::text, 1, 10) >= $1 AND substr(expense_on::text, 1, 10) <= $2
         AND COALESCE(cost_phase, 'delivery') = $3`,
      [start, end, phase],
    );
    return Number((result.rows[0] as { v?: unknown })?.v ?? 0);
  }
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_expenses
     WHERE substr(expense_on::text, 1, 10) >= $1 AND substr(expense_on::text, 1, 10) <= $2`,
    [start, end],
  );
  return Number((result.rows[0] as { v?: unknown })?.v ?? 0);
}

async function proxyCashPosition(pool: Pool, asOf: string): Promise<number> {
  if (!(await tableExists(pool, 'crm_svc_payments')) || !(await tableExists(pool, 'crm_svc_expenses'))) {
    return 0;
  }
  const recv = await pool.query(
    `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_payments
     WHERE status = 'received' AND substr(received_on::text, 1, 10) <= $1`,
    [asOf],
  );
  const exp = await pool.query(
    `SELECT COALESCE(SUM(amount_vnd), 0) AS v FROM crm_svc_expenses
     WHERE substr(expense_on::text, 1, 10) <= $1`,
    [asOf],
  );
  return Number((recv.rows[0] as { v?: unknown })?.v ?? 0) - Number((exp.rows[0] as { v?: unknown })?.v ?? 0);
}

export async function getCashSnapshotOnOrBeforePg(
  pool: Pool,
  asOf: string,
): Promise<Record<string, unknown> | null> {
  const result = await pool.query(
    `SELECT id, snapshot_on, balance_vnd, source, notes, updated_at
     FROM crm_owner_cash_snapshots
     WHERE snapshot_on <= $1
     ORDER BY snapshot_on DESC
     LIMIT 1`,
    [asOf],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: Number(row.sqlite_snapshot_id ?? row.id),
    snapshot_on: String(row.snapshot_on).slice(0, 10),
    balance_vnd: Number(row.balance_vnd ?? 0),
    source: String(row.source ?? CASH_SOURCE_MANUAL),
    notes: String(row.notes ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function listCashSnapshotsPg(
  pool: Pool,
  limit = 24,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `SELECT id, sqlite_snapshot_id, snapshot_on, balance_vnd, source, notes, updated_at
     FROM crm_owner_cash_snapshots
     ORDER BY snapshot_on DESC
     LIMIT $1`,
    [Math.max(1, limit)],
  );
  return result.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: Number(row.sqlite_snapshot_id ?? row.id),
      snapshot_on: String(row.snapshot_on).slice(0, 10),
      balance_vnd: Number(row.balance_vnd ?? 0),
      source: String(row.source ?? CASH_SOURCE_MANUAL),
      notes: String(row.notes ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  });
}

export async function upsertCashSnapshotPg(
  pool: Pool,
  snapshotOn: string,
  balanceVnd: number,
  source = CASH_SOURCE_MANUAL,
  notes = '',
): Promise<Record<string, unknown>> {
  const snap = parseYmd(snapshotOn);
  if (!snap) throw new Error('snapshot_on không hợp lệ (YYYY-MM-DD).');
  let src = String(source || CASH_SOURCE_MANUAL).trim().toLowerCase();
  if (!CASH_SOURCES.has(src)) src = CASH_SOURCE_MANUAL;
  await pool.query(
    `INSERT INTO crm_owner_cash_snapshots (snapshot_on, balance_vnd, source, notes, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (snapshot_on) DO UPDATE SET
       balance_vnd = EXCLUDED.balance_vnd,
       source = EXCLUDED.source,
       notes = EXCLUDED.notes,
       updated_at = NOW()`,
    [snap, Math.trunc(balanceVnd), src, String(notes || '').trim()],
  );
  const row = await getCashSnapshotOnOrBeforePg(pool, snap);
  return row!;
}

export async function deleteCashSnapshotPg(pool: Pool, snapshotOn: string): Promise<boolean> {
  const snap = parseYmd(snapshotOn);
  if (!snap) throw new Error('snapshot_on không hợp lệ.');
  const result = await pool.query(`DELETE FROM crm_owner_cash_snapshots WHERE snapshot_on = $1`, [snap]);
  return (result.rowCount ?? 0) > 0;
}

export async function getCashPositionPg(pool: Pool, asOf: string): Promise<Record<string, unknown>> {
  const snapshot = await getCashSnapshotOnOrBeforePg(pool, asOf);
  if (!snapshot) {
    return {
      as_of: asOf,
      position_vnd: await proxyCashPosition(pool, asOf),
      source: POSITION_SOURCE_PROXY,
      snapshot: null,
      flow_adjustment_vnd: 0,
    };
  }
  const snapOn = String(snapshot.snapshot_on);
  const base = Number(snapshot.balance_vnd);
  if (snapOn >= asOf) {
    return {
      as_of: asOf,
      position_vnd: base,
      source: POSITION_SOURCE_LEDGER,
      snapshot,
      flow_adjustment_vnd: 0,
    };
  }
  const flowStart = addDays(snapOn, 1);
  const cashIn = await sumReceivedBetween(pool, flowStart, asOf);
  const cashOut = await sumExpensesBetween(pool, flowStart, asOf);
  const adjustment = cashIn - cashOut;
  return {
    as_of: asOf,
    position_vnd: base + adjustment,
    source: POSITION_SOURCE_LEDGER,
    snapshot,
    flow_adjustment_vnd: adjustment,
    flow_cash_in_vnd: cashIn,
    flow_cash_out_vnd: cashOut,
  };
}

export async function getOwnerWeeklyTargetsPg(pool: Pool): Promise<Record<string, number>> {
  const result = await pool.query(
    `SELECT config_key, config_value FROM crm_owner_weekly_config WHERE config_key LIKE 'owner_%'`,
  );
  const dbMap: Record<string, string> = {};
  for (const r of result.rows as Array<Record<string, unknown>>) {
    const key = String(r.config_key).replace(/^owner_/, '');
    dbMap[key] = String(r.config_value);
  }
  const out: Record<string, number> = {};
  for (const [key, defaultVal] of Object.entries(OWNER_WEEKLY_TARGET_DEFAULTS)) {
    if (key in dbMap) {
      const raw = dbMap[key]!.trim();
      const parsed = Number.isInteger(defaultVal) ? parseInt(raw, 10) : parseFloat(raw);
      if (Number.isFinite(parsed)) {
        out[key] = parsed;
        continue;
      }
    }
    const envKey = OWNER_WEEKLY_ENV_KEYS[key];
    out[key] = envKey ? envNumber(envKey, defaultVal) : defaultVal;
  }
  return out;
}

export async function setOwnerWeeklyTargetsPg(
  pool: Pool,
  updates: Record<string, unknown>,
): Promise<Record<string, number>> {
  for (const [key, value] of Object.entries(updates)) {
    if (!(key in OWNER_WEEKLY_TARGET_DEFAULTS)) continue;
    const defaultVal = OWNER_WEEKLY_TARGET_DEFAULTS[key]!;
    const val = Number.isInteger(defaultVal) ? Math.max(0, Math.trunc(Number(value))) : Number(value);
    await pool.query(
      `INSERT INTO crm_owner_weekly_config (config_key, config_value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (config_key) DO UPDATE SET
         config_value = EXCLUDED.config_value,
         updated_at = NOW()`,
      [`owner_${key}`, String(val)],
    );
  }
  return getOwnerWeeklyTargetsPg(pool);
}

function ragHigherBetter(value: number, target: number): string {
  if (value >= target) return RAG_GREEN;
  if (value >= target * 0.85) return RAG_YELLOW;
  return RAG_RED;
}

function ragLowerBetter(value: number, target: number): string {
  if (value <= target) return RAG_GREEN;
  if (value <= target * 1.15) return RAG_YELLOW;
  return RAG_RED;
}

function metric(opts: Record<string, unknown>): Record<string, unknown> {
  return {
    status_label: RAG_LABELS[String(opts.status)] ?? String(opts.status),
    format: opts.fmt ?? 'number',
    ...opts,
  };
}

function buildPreExecutionBrief(dashboard: Record<string, unknown>): Record<string, unknown> {
  const actions: Record<string, unknown>[] = [];
  const blocks = dashboard.blocks as Record<string, Record<string, unknown>>;
  for (const blockKey of BLOCK_KEYS) {
    const block = blocks[blockKey];
    if (!block) continue;
    for (const m of (block.metrics as Record<string, unknown>[]) ?? []) {
      const status = String(m.status ?? RAG_GREEN);
      if (status === RAG_GREEN) continue;
      actions.push({
        metric_key: m.key,
        metric_label: m.label,
        block: blockKey,
        block_label: block.label,
        status,
        status_label: m.status_label,
        hint: m.note ?? '',
        steps: [],
      });
    }
  }
  return {
    actions,
    action_count: actions.length,
    red_count: actions.filter((a) => a.status === RAG_RED).length,
    yellow_count: actions.filter((a) => a.status === RAG_YELLOW).length,
  };
}

export async function getOwnerWeeklyDashboardPg(
  pool: Pool,
  opts: { weekEnd?: string | null; year?: number | null; isoWeek?: number | null; trendWeeks?: number },
): Promise<Record<string, unknown>> {
  const bounds = resolveWeekBounds(opts);
  const { start, end, isoYear, isoWeek: isoWeekNum } = bounds;
  const targets = await getOwnerWeeklyTargetsPg(pool);

  const cashCloseMeta = await getCashPositionPg(pool, end);
  const cashClose = Number(cashCloseMeta.position_vnd ?? 0);
  const cashIn = await sumReceivedBetween(pool, start, end);
  const cashOut = await sumExpensesBetween(pool, start, end);
  const ar = await getArAging(pool, { asOf: end });
  const arOverdue = Number(ar.total_overdue_vnd ?? 0);

  const recvWeek = cashIn;
  const delWeek = await sumExpensesBetween(pool, start, end, COST_PHASE_DELIVERY);
  const presalesWeek = await sumExpensesBetween(pool, start, end, COST_PHASE_PRESALES);
  const grossMargin = recvWeek > 0 ? Math.round(((recvWeek - delWeek) / recvWeek) * 1000) / 10 : 0;
  const netMargin =
    recvWeek > 0 ? Math.round(((recvWeek - delWeek - presalesWeek) / recvWeek) * 1000) / 10 : 0;

  const cashMetrics = [
    metric({
      key: 'cash_close',
      label: 'Tiền cuối tuần',
      value: cashClose,
      fmt: 'vnd',
      status: ragHigherBetter(cashClose, targets.cash_safe_min_vnd!),
      target: targets.cash_safe_min_vnd,
    }),
    metric({
      key: 'cash_in',
      label: 'Thu tuần',
      value: cashIn,
      fmt: 'vnd',
      status: ragHigherBetter(cashIn, targets.revenue_target_vnd!),
      target: targets.revenue_target_vnd,
    }),
    metric({
      key: 'ar_overdue',
      label: 'AR quá hạn',
      value: arOverdue,
      fmt: 'vnd',
      status: ragLowerBetter(arOverdue, targets.ar_overdue_max_vnd!),
      target: targets.ar_overdue_max_vnd,
    }),
  ];

  const salesMetrics = [
    metric({
      key: 'revenue_actual',
      label: 'Doanh thu tuần',
      value: recvWeek,
      fmt: 'vnd',
      status: ragHigherBetter(recvWeek, targets.revenue_target_vnd!),
      target: targets.revenue_target_vnd,
    }),
    metric({
      key: 'win_rate',
      label: 'Win rate (tuần)',
      value: 0,
      fmt: 'pct',
      status: RAG_GREEN,
      target: targets.close_rate_target_pct,
      note: 'MVP — simplified',
    }),
  ];

  const efficiencyMetrics = [
    metric({
      key: 'gross_margin',
      label: 'Gross margin',
      value: grossMargin,
      fmt: 'pct',
      status: ragHigherBetter(grossMargin, targets.gross_margin_target_pct!),
      target: targets.gross_margin_target_pct,
    }),
    metric({
      key: 'net_margin',
      label: 'Net margin',
      value: netMargin,
      fmt: 'pct',
      status: ragHigherBetter(netMargin, targets.net_margin_target_pct!),
      target: targets.net_margin_target_pct,
    }),
  ];

  const riskMetrics = [
    metric({
      key: 'top_customer_share',
      label: 'Tỷ trọng DT khách lớn nhất',
      value: 0,
      fmt: 'pct',
      status: RAG_GREEN,
      target: targets.top1_share_max_pct,
      note: 'MVP — simplified',
    }),
  ];

  const blocks: Record<string, Record<string, unknown>> = {
    cash: { key: 'cash', label: BLOCK_LABELS.cash, metrics: cashMetrics },
    sales: { key: 'sales', label: BLOCK_LABELS.sales, metrics: salesMetrics },
    efficiency: { key: 'efficiency', label: BLOCK_LABELS.efficiency, metrics: efficiencyMetrics },
    risk: { key: 'risk', label: BLOCK_LABELS.risk, metrics: riskMetrics },
  };

  const allMetrics = BLOCK_KEYS.flatMap((k) => (blocks[k]?.metrics as Record<string, unknown>[]) ?? []);
  const ragCounts = {
    [RAG_GREEN]: allMetrics.filter((m) => m.status === RAG_GREEN).length,
    [RAG_YELLOW]: allMetrics.filter((m) => m.status === RAG_YELLOW).length,
    [RAG_RED]: allMetrics.filter((m) => m.status === RAG_RED).length,
  };

  const dashboard: Record<string, unknown> = {
    week: {
      iso_year: isoYear,
      iso_week: isoWeekNum,
      start,
      end,
      label: `Tuần ${isoWeekNum}/${isoYear} (${formatDdMm(start)} – ${formatDdMm(end)})`,
    },
    blocks,
    targets,
    rag_counts: ragCounts,
    rag_legend: RAG_LABELS,
    cash_ledger: {
      position_source: cashCloseMeta.source,
      has_snapshot: cashCloseMeta.source === POSITION_SOURCE_LEDGER,
      latest_snapshot: cashCloseMeta.snapshot,
      snapshots: await listCashSnapshotsPg(pool, 8),
      forecast: { forecast_vnd: cashClose, as_of: end, method: 'mvp_stub' },
    },
    trends: { weeks: opts.trendWeeks ?? 8, labels: [], cash_close_vnd: [] },
    retention_weekly: { customer_churn_pct: 0 },
  };
  dashboard.pre_execution = buildPreExecutionBrief(dashboard);
  return dashboard;
}

export async function getOwnerWeeklyInboxSummaryPg(pool: Pool): Promise<Record<string, unknown>> {
  if (!(await tableExists(pool, 'crm_reminders'))) {
    return { pending_count: 0, critical_count: 0, warning_count: 0, items: [] };
  }
  const result = await pool.query(
    `SELECT id, title, body, remind_at, status, meta_json
     FROM crm_reminders
     WHERE scope = 'owner_weekly' AND reminder_kind = 'owner_weekly_alert' AND status = 'pending'
     ORDER BY remind_at ASC, id ASC
     LIMIT 100`,
  );
  const items: Record<string, unknown>[] = [];
  let critical = 0;
  let warning = 0;
  for (const d of result.rows as Array<Record<string, unknown>>) {
    let meta: Record<string, unknown> = {};
    try {
      meta = (d.meta_json ?? {}) as Record<string, unknown>;
      if (typeof d.meta_json === 'string') {
        meta = JSON.parse(d.meta_json) as Record<string, unknown>;
      }
    } catch {
      meta = {};
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
      iso_year: meta.iso_year,
      iso_week: meta.iso_week,
      metric_key: meta.metric_key,
    });
  }
  return { pending_count: items.length, critical_count: critical, warning_count: warning, items };
}

export async function syncOwnerWeeklyInboxStubPg(
  pool: Pool,
  isoYear: number,
  isoWeek: number,
  dashboard?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const dash = dashboard ?? (await getOwnerWeeklyDashboardPg(pool, { year: isoYear, isoWeek }));
  const brief = dash.pre_execution as Record<string, unknown>;
  return {
    iso_year: isoYear,
    iso_week: isoWeek,
    period_ref: isoYear * 100 + isoWeek,
    synced: Number(brief.action_count ?? 0),
    removed: 0,
    action_count: Number(brief.action_count ?? 0),
  };
}
