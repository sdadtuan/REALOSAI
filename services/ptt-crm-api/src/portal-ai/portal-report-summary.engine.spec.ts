import { buildPortalReportSummary } from './portal-report-summary.engine';

describe('portal-report-summary.engine', () => {
  const period = {
    from: '2026-07-21',
    to: '2026-07-27',
    label: 'Tuần này (21/07 → 27/07)',
    days: 7,
  };

  it('returns empty-state narrative when no spend or leads', () => {
    const out = buildPortalReportSummary({
      client_id: 'client-1',
      period,
      kpis: {
        total_spend: 0,
        total_leads_crm: 0,
        avg_cpl: null,
        avg_roas: null,
        campaigns_tracked: 0,
        over_target_rows: 0,
        unmapped_spend_pct: 0,
      },
      channels: [],
    });
    expect(out.narrative).toMatch(/chưa ghi nhận/i);
    expect(out.bullets.length).toBeGreaterThan(0);
  });

  it('builds 3-sentence narrative with KPI highlights', () => {
    const out = buildPortalReportSummary({
      client_id: 'client-1',
      period,
      kpis: {
        total_spend: 125_000_000,
        total_leads_crm: 48,
        avg_cpl: 2_600_000,
        avg_roas: 2.1,
        campaigns_tracked: 6,
        over_target_rows: 3,
        unmapped_spend_pct: 12,
      },
      channels: [
        { channel: 'meta', spend: 90_000_000, leads_crm: 35, avg_cpl: 2_571_428.57 },
        { channel: 'google', spend: 25_000_000, leads_crm: 10, avg_cpl: 2_500_000 },
        { channel: 'zalo', spend: 10_000_000, leads_crm: 3, avg_cpl: 3_333_333.33 },
      ],
    });
    expect(out.narrative).toMatch(/125 triệu VND/i);
    expect(out.narrative).toMatch(/48 lead CRM/i);
    expect(out.narrative).toMatch(/ROAS/i);
    expect(out.bullets.some((b) => /Meta/i.test(b))).toBe(true);
  });
});
