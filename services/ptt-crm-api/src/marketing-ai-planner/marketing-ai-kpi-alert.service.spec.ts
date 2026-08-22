import { MarketingAiKpiAlertService } from './marketing-ai-kpi-alert.service';

describe('MarketingAiKpiAlertService', () => {
  const config = {
    mktAiPlannerEnabled: true,
    mktAiKpiAlertEnabled: true,
    mktAiPlannerSlugs: ['meta-lead-gen'],
    mktAiKpiAlertCplPct: 15,
    mktAiKpiAlertRoasPct: 20,
    mktAiKpiAlertCooldownDays: 7,
    mktAiApproverNotifyUserIds: ['uuid-approver'],
    databaseUrl: 'postgresql://localhost/test',
  };

  const lifecycle = {
    list: jest.fn(),
    context: jest.fn(),
  };
  const dashboard = { getDashboard: jest.fn() };
  const notifications = {
    hasRecentAlertKey: jest.fn(),
    createMany: jest.fn(),
  };

  let service: MarketingAiKpiAlertService;

  const lcRow = {
    id: 1,
    lead_id: 10,
    customer_id: null,
    contract_id: 1,
    service_slug: 'meta-lead-gen',
    stage: 'deliver',
    status: 'active',
    assigned_am: 5,
    assigned_sp: 6,
    stage_entered_at: '',
    notes: '',
    marketing_plan_id: null,
    sop_run_id: null,
    created_at: '',
    updated_at: '',
  };

  const dashPayload = {
    ok: true,
    lifecycle_id: 1,
    stage: 'deliver',
    agency_client_id: 'CLI-1',
    linked: true,
    period: { from: '2026-07-01', to: '2026-08-07', weeks: 6, month_start: '2026-08-01' },
    tiles: {
      spend_mtd_vnd: 5_000_000,
      leads_mtd: 20,
      cpl_mtd: 250_000,
      roas_mtd: 1.8,
      roas_stub: false,
    },
    targets: { cpl_vnd: 200_000, roas: null, source: 'daily_performance' as const },
    trend: [
      {
        week_label: 'Tuần 28/07',
        week_start: '2026-07-28',
        spend_vnd: 1_000_000,
        leads: 10,
        cpl: 100_000,
        roas: 2.5,
        roas_stub: false,
      },
      {
        week_label: 'Tuần 04/08',
        week_start: '2026-08-04',
        spend_vnd: 1_200_000,
        leads: 8,
        cpl: 150_000,
        roas: 1.8,
        roas_stub: false,
      },
    ],
    deltas: { cpl_vs_target_pct: 22, spend_vs_prev_week_pct: 20 },
    flags: { perf_tables_ready: true },
    messages: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiKpiAlertService(
      config as never,
      lifecycle as never,
      dashboard as never,
      notifications as never,
    );
    lifecycle.list.mockResolvedValue({ lifecycles: [lcRow], funnel_stats: {} });
    lifecycle.context.mockResolvedValue({
      lead: { full_name: 'ABC Logistics' },
      contract: { title: '', agency_client_id: 'CLI-1' },
    });
    dashboard.getDashboard.mockResolvedValue(dashPayload);
    notifications.hasRecentAlertKey.mockResolvedValue(false);
    notifications.createMany.mockResolvedValue(1);
    jest.spyOn(service as unknown as { resolveUserIdByCrmStaffId: () => Promise<string | null> }, 'resolveUserIdByCrmStaffId').mockResolvedValue('uuid-am');
  });

  it('runWeeklyScan returns skipped when disabled', async () => {
    const disabled = new MarketingAiKpiAlertService(
      { ...config, mktAiKpiAlertEnabled: false } as never,
      lifecycle as never,
      dashboard as never,
      notifications as never,
    );
    const out = await disabled.runWeeklyScan();
    expect(out.skipped).toBe(true);
    expect(out.scanned).toBe(0);
  });

  it('runWeeklyScan sends notifications for drift', async () => {
    const out = await service.runWeeklyScan();
    expect(out.scanned).toBe(1);
    expect(out.drift_found).toBeGreaterThan(0);
    expect(notifications.createMany).toHaveBeenCalled();
    const payload = notifications.createMany.mock.calls[0][0];
    expect(payload[0].kind).toBe('mkt_ai_kpi_drift');
    expect(payload[0].link_href).toContain('tab=ai-planner');
  });

  it('runWeeklyScan dryRun does not create notifications', async () => {
    const out = await service.runWeeklyScan({ dryRun: true });
    expect(out.notifications_sent).toBeGreaterThan(0);
    expect(notifications.createMany).not.toHaveBeenCalled();
  });
});
