import { GtmSandboxBoardService, getSandboxBoardKpis } from './gtm-sandbox-board.service';

describe('GtmSandboxBoardService', () => {
  const svc = new GtmSandboxBoardService();

  it('returns agency KPIs for sandbox_agency tenant', () => {
    const kpis = svc.getKpis('sandbox_agency');
    expect(kpis.industry).toBe('agency');
    expect(kpis.leads_this_week).toBe(18);
    expect(kpis.cpl_demo_usd).toBe(42);
    expect(kpis.demos_booked).toBe(6);
    expect(kpis.sample_data).toBe(true);
  });

  it('falls back to other industry for unknown tenant', () => {
    const kpis = getSandboxBoardKpis('sandbox_unknown');
    expect(kpis.industry).toBe('other');
  });
});
