import type { PerformanceRow } from '../performance/performance.types';
import { computeCpl, computeRoas, formatDateOnly } from '../performance/performance.util';

export interface MktAiDashboardTrendWeek {
  week_label: string;
  week_start: string;
  spend_vnd: number;
  leads: number;
  cpl: number | null;
  roas: number | null;
  roas_stub: boolean;
}

export interface MktAiDashboardTiles {
  spend_mtd_vnd: number;
  leads_mtd: number;
  cpl_mtd: number | null;
  roas_mtd: number | null;
  roas_stub: boolean;
}

export interface MktAiDashboardDeltas {
  cpl_vs_target_pct: number | null;
  spend_vs_prev_week_pct: number | null;
}

export interface MktAiDashboardTargets {
  cpl_vnd: number | null;
  roas: number | null;
  source: 'daily_performance' | 'none';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return formatDateOnly(d);
}

function weekLabel(weekStart: string): string {
  const parts = weekStart.split('-');
  return `Tuần ${parts[2]}/${parts[1]}`;
}

function aggregateRows(rows: PerformanceRow[]): {
  spend: number;
  leads: number;
  conversionValue: number;
  roasStub: boolean;
  targetCpl: number | null;
} {
  let spend = 0;
  let leads = 0;
  let conversionValue = 0;
  let roasStub = false;
  const targets: number[] = [];

  for (const row of rows) {
    spend += Number(row.spend ?? 0);
    leads += Number(row.leads_crm ?? 0);
    conversionValue += Number(row.conversion_value ?? 0);
    if (row.roas_stub) roasStub = true;
    if (row.target_cpl_vnd != null && row.target_cpl_vnd > 0) {
      targets.push(row.target_cpl_vnd);
    }
  }

  return {
    spend: round2(spend),
    leads,
    conversionValue: round2(conversionValue),
    roasStub,
    targetCpl: targets.length ? round2(targets.reduce((a, b) => a + b, 0) / targets.length) : null,
  };
}

export function buildDashboardTargets(rows: PerformanceRow[]): MktAiDashboardTargets {
  const agg = aggregateRows(rows);
  return {
    cpl_vnd: agg.targetCpl,
    roas: null,
    source: agg.targetCpl != null ? 'daily_performance' : 'none',
  };
}

export function buildDashboardTiles(rows: PerformanceRow[], monthStart: string, dateTo: string): MktAiDashboardTiles {
  const mtdRows = rows.filter((r) => {
    const d = String(r.performance_date ?? '').slice(0, 10);
    return d >= monthStart && d <= dateTo;
  });
  const agg = aggregateRows(mtdRows);
  return {
    spend_mtd_vnd: agg.spend,
    leads_mtd: agg.leads,
    cpl_mtd: computeCpl(agg.spend, agg.leads),
    roas_mtd: computeRoas(agg.conversionValue, agg.spend),
    roas_stub: agg.roasStub,
  };
}

export function buildDashboardTrend(
  rows: PerformanceRow[],
  weeks: number,
  dateTo: string,
): MktAiDashboardTrendWeek[] {
  const end = new Date(`${dateTo}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - weeks * 7 + 1);
  const startStr = formatDateOnly(start);

  const inRange = rows.filter((r) => {
    const d = String(r.performance_date ?? '').slice(0, 10);
    return d >= startStr && d <= dateTo;
  });

  const buckets = new Map<string, PerformanceRow[]>();
  for (const row of inRange) {
    const d = String(row.performance_date ?? '').slice(0, 10);
    if (!d) continue;
    const ws = isoWeekStart(d);
    const list = buckets.get(ws) ?? [];
    list.push(row);
    buckets.set(ws, list);
  }

  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const last = sorted.slice(-weeks);

  return last.map(([weekStart, bucketRows]) => {
    const agg = aggregateRows(bucketRows);
    return {
      week_label: weekLabel(weekStart),
      week_start: weekStart,
      spend_vnd: agg.spend,
      leads: agg.leads,
      cpl: computeCpl(agg.spend, agg.leads),
      roas: computeRoas(agg.conversionValue, agg.spend),
      roas_stub: agg.roasStub,
    };
  });
}

export function buildDashboardDeltas(
  trend: MktAiDashboardTrendWeek[],
  targets: MktAiDashboardTargets,
): MktAiDashboardDeltas {
  let cplVsTarget: number | null = null;
  const latest = trend[trend.length - 1];
  if (latest?.cpl != null && targets.cpl_vnd != null && targets.cpl_vnd > 0) {
    cplVsTarget = round2(((latest.cpl - targets.cpl_vnd) / targets.cpl_vnd) * 100);
  }

  let spendVsPrev: number | null = null;
  if (trend.length >= 2) {
    const prev = trend[trend.length - 2];
    const curr = trend[trend.length - 1];
    if (prev.spend_vnd > 0) {
      spendVsPrev = round2(((curr.spend_vnd - prev.spend_vnd) / prev.spend_vnd) * 100);
    }
  }

  return {
    cpl_vs_target_pct: cplVsTarget,
    spend_vs_prev_week_pct: spendVsPrev,
  };
}

export function resolveDashboardDateWindow(weeks: number): {
  dateFrom: string;
  dateTo: string;
  monthStart: string;
} {
  const today = new Date();
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
  const dateTo = formatDateOnly(yesterday);
  const monthStart = formatDateOnly(
    new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)),
  );
  const trendStart = new Date(yesterday);
  trendStart.setUTCDate(trendStart.getUTCDate() - weeks * 7 + 1);
  const weekStartStr = formatDateOnly(trendStart);
  const queryStart = weekStartStr < monthStart ? weekStartStr : monthStart;
  return { dateFrom: queryStart, dateTo, monthStart };
}
