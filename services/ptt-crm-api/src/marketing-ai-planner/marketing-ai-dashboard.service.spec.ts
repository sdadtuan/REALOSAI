import { MarketingAiDashboardService } from './marketing-ai-dashboard.service';

describe('MarketingAiDashboardService', () => {
  const config = { mktAiPlannerEnabled: true, mktAiPlannerSlugs: [] as string[] };
  const lifecycle = {
    detail: jest.fn(),
    context: jest.fn(),
  };
  const performance = {
    listForClient: jest.fn(),
  };

  let service: MarketingAiDashboardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiDashboardService(config as never, lifecycle as never, performance as never);
    lifecycle.detail.mockResolvedValue({ id: 1, stage: 'deliver', service_slug: 'meta-lead-gen' });
  });

  it('returns unlinked payload when agency_client_id missing', async () => {
    lifecycle.context.mockResolvedValue({
      contract: { agency_client_id: '' },
    });

    const out = await service.getDashboard(1);

    expect(out.linked).toBe(false);
    expect(out.messages[0]).toContain('agency client');
    expect(performance.listForClient).not.toHaveBeenCalled();
  });

  it('aggregates performance rows when linked', async () => {
    lifecycle.context.mockResolvedValue({
      contract: { agency_client_id: 'CLI-001' },
    });
    performance.listForClient.mockResolvedValue({
      rows: [
        {
          performance_date: '2026-08-01',
          spend: 2_000_000,
          leads_crm: 20,
          conversion_value: 6_000_000,
          target_cpl_vnd: 100_000,
          roas_stub: false,
        },
      ],
    });

    const out = await service.getDashboard(1, { weeks: 6 });

    expect(out.linked).toBe(true);
    expect(out.flags.perf_tables_ready).toBe(true);
    expect(out.tiles.spend_mtd_vnd).toBeGreaterThan(0);
    expect(out.trend.length).toBeGreaterThan(0);
  });
});
