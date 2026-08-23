import { clampInbox, sellThroughPct, withW6HubKpi } from './bds-hub.util';

describe('bds-hub.util', () => {
  it('sellThroughPct 2/8 → 25', () => {
    expect(sellThroughPct(2, 8)).toBe(25);
  });

  it('clampInbox max 8', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      kind: 'hold_f1_pending' as const,
      id: String(i),
      label: 'x',
      href: '/crm/bds/holds',
    }));
    expect(clampInbox(rows)).toHaveLength(8);
  });

  it('withW6HubKpi defaults missing fields to 0', () => {
    const out = withW6HubKpi({
      sell_through_pct: 10,
      gmv_contracted_month_vnd: 2,
      overdue_gt_30d: 1,
      holds_expiring_2h: 3,
    });
    expect(out.cskh_breach_15m).toBe(0);
    expect(out.receipts_today_count).toBe(0);
    expect(out.sell_through_pct).toBe(10);
  });

  it('withW6HubKpi keeps provided W6 fields', () => {
    const out = withW6HubKpi({
      sell_through_pct: 10,
      gmv_contracted_month_vnd: 2,
      overdue_gt_30d: 1,
      holds_expiring_2h: 3,
      cskh_breach_15m: 4,
      receipts_today_count: 7,
    });
    expect(out.cskh_breach_15m).toBe(4);
    expect(out.receipts_today_count).toBe(7);
  });
});
