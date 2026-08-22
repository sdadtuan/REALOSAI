import type { HubInboxRow } from './bds-hub.types';

export function clampInbox(rows: HubInboxRow[], max = 8): HubInboxRow[] {
  return rows.slice(0, max);
}

export function sellThroughPct(sold: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((sold / total) * 100);
}

export function periodMonthStart(input?: string, now = new Date()): string {
  const raw = String(input ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
