import { buildHdqtCsv, clampInbox, sellThroughPct, withW6HubKpi, withW7HubKpi } from './bds-hub.util';

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

  it('withW7HubKpi defaults CFO fields to 0', () => {
    const out = withW7HubKpi({
      sell_through_pct: 10,
      gmv_contracted_month_vnd: 2,
      overdue_gt_30d: 1,
      holds_expiring_2h: 3,
      cskh_breach_15m: 0,
      receipts_today_count: 0,
    });
    expect(out.collected_month_vnd).toBe(0);
    expect(out.hh_payable_month_vnd).toBe(0);
  });

  it('withW7HubKpi keeps provided CFO fields', () => {
    const out = withW7HubKpi({
      sell_through_pct: 10,
      gmv_contracted_month_vnd: 2,
      overdue_gt_30d: 1,
      holds_expiring_2h: 3,
      collected_month_vnd: 500,
      hh_payable_month_vnd: 80,
    });
    expect(out.collected_month_vnd).toBe(500);
    expect(out.hh_payable_month_vnd).toBe(80);
  });

  it('buildHdqtCsv has 4 CFO columns and GMV contracted', () => {
    const csv = buildHdqtCsv(
      {
        sell_through_pct: 10,
        gmv_contracted_month_vnd: 9_000,
        overdue_gt_30d: 2,
        holds_expiring_2h: 0,
        cskh_breach_15m: 0,
        receipts_today_count: 0,
        collected_month_vnd: 1_000,
        hh_payable_month_vnd: 300,
      },
      '2026-08-01',
    );
    expect(csv.split('\n')[0]).toBe(
      'period,gmv_contracted_month_vnd,collected_month_vnd,overdue_gt_30d,hh_payable_month_vnd',
    );
    expect(csv).toContain('2026-08-01,9000,1000,2,300');
    expect(csv).not.toContain('list_price');
  });
});
