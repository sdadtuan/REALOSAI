import type { HubInboxRow, HubKpi } from './bds-hub.types';

export function clampInbox(rows: HubInboxRow[], max = 8): HubInboxRow[] {
  return rows.slice(0, max);
}

export function sellThroughPct(sold: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((sold / total) * 100);
}

export function withW6HubKpi(
  kpi: Omit<
    HubKpi,
    'cskh_breach_15m' | 'receipts_today_count' | 'collected_month_vnd' | 'hh_payable_month_vnd'
  > &
    Partial<
      Pick<
        HubKpi,
        'cskh_breach_15m' | 'receipts_today_count' | 'collected_month_vnd' | 'hh_payable_month_vnd'
      >
    >,
): HubKpi {
  return {
    ...kpi,
    cskh_breach_15m: Number(kpi.cskh_breach_15m ?? 0),
    receipts_today_count: Number(kpi.receipts_today_count ?? 0),
    collected_month_vnd: Number(kpi.collected_month_vnd ?? 0),
    hh_payable_month_vnd: Number(kpi.hh_payable_month_vnd ?? 0),
  };
}

export function withW7HubKpi(
  kpi: Omit<
    HubKpi,
    'collected_month_vnd' | 'hh_payable_month_vnd' | 'cskh_breach_15m' | 'receipts_today_count'
  > &
    Partial<
      Pick<HubKpi, 'collected_month_vnd' | 'hh_payable_month_vnd' | 'cskh_breach_15m' | 'receipts_today_count'>
    >,
): HubKpi {
  const w6 = withW6HubKpi(kpi);
  return {
    ...w6,
    collected_month_vnd: Number(kpi.collected_month_vnd ?? 0),
    hh_payable_month_vnd: Number(kpi.hh_payable_month_vnd ?? 0),
  };
}

export function buildHdqtCsv(kpi: HubKpi, period: string): string {
  const header =
    'period,gmv_contracted_month_vnd,collected_month_vnd,overdue_gt_30d,hh_payable_month_vnd';
  const line = [
    period,
    kpi.gmv_contracted_month_vnd,
    kpi.collected_month_vnd,
    kpi.overdue_gt_30d,
    kpi.hh_payable_month_vnd,
  ].join(',');
  return `${header}\n${line}\n`;
}

export function periodMonthStart(input?: string, now = new Date()): string {
  const raw = String(input ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
