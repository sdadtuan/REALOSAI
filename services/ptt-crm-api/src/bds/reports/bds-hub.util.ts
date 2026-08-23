import type { HubInboxRow, HubKpi } from './bds-hub.types';

export function clampInbox(rows: HubInboxRow[], max = 8): HubInboxRow[] {
  return rows.slice(0, max);
}

export function sellThroughPct(sold: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((sold / total) * 100);
}

export function withW6HubKpi(
  kpi: Omit<HubKpi, 'cskh_breach_15m' | 'receipts_today_count'> &
    Partial<Pick<HubKpi, 'cskh_breach_15m' | 'receipts_today_count'>>,
): HubKpi {
  return {
    ...kpi,
    cskh_breach_15m: Number(kpi.cskh_breach_15m ?? 0),
    receipts_today_count: Number(kpi.receipts_today_count ?? 0),
  };
}

export function periodMonthStart(input?: string, now = new Date()): string {
  const raw = String(input ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
