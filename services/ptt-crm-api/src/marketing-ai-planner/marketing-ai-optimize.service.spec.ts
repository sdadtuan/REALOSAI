import { MarketingAiOptimizeService } from './marketing-ai-optimize.service';

describe('MarketingAiOptimizeService', () => {
  const config = { mktAiPlannerEnabled: true, mktAiPlannerSlugs: [] as string[] };
  const lifecycle = {
    detail: jest.fn(),
    createCustomTask: jest.fn(),
  };
  const dashboard = { getDashboard: jest.fn() };
  const orchestrator = { generateOptimizeRecommendations: jest.fn() };
  const repo = {
    getBrief: jest.fn(),
    ensureDraft: jest.fn(),
  };

  let service: MarketingAiOptimizeService;

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
      roas_mtd: 2.1,
      roas_stub: false,
    },
    targets: { cpl_vnd: 200_000, roas: null, source: 'daily_performance' as const },
    trend: [],
    deltas: { cpl_vs_target_pct: 25, spend_vs_prev_week_pct: 10 },
    flags: { perf_tables_ready: true },
    messages: [],
  };

  const recs = [
    {
      id: 'opt-narrow-audience',
      title: 'Thu hẹp audience',
      rationale: 'CPL cao',
      priority: 'high' as const,
      suggested_task: { stage: 'deliver', title: 'Thu hẹp audience', description: 'Rà soát ad set' },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiOptimizeService(
      config as never,
      lifecycle as never,
      dashboard as never,
      orchestrator as never,
      repo as never,
    );
    lifecycle.detail.mockResolvedValue({ id: 1, stage: 'deliver', service_slug: 'meta-lead-gen' });
    dashboard.getDashboard.mockResolvedValue(dashPayload);
    repo.getBrief.mockResolvedValue({ brief_json: { brand_name: 'Acme' } });
    repo.ensureDraft.mockResolvedValue({ campaigns_json: [] });
    orchestrator.generateOptimizeRecommendations.mockResolvedValue(recs);
  });

  it('preview mode returns recommendations without tasks', async () => {
    const out = await service.execute(1, { confirm_create_tasks: false });

    expect(out.recommendations).toHaveLength(1);
    expect(out.kpi_context.cpl_delta_pct).toBe(25);
    expect(out.tasks_created).toBeUndefined();
    expect(lifecycle.createCustomTask).not.toHaveBeenCalled();
  });

  it('confirm_create_tasks creates lifecycle tasks', async () => {
    lifecycle.createCustomTask.mockResolvedValue({ task: { id: 42 } });

    const out = await service.execute(1, {
      confirm_create_tasks: true,
      recommendation_ids: ['opt-narrow-audience'],
    });

    expect(lifecycle.createCustomTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ stage: 'deliver', title: 'Thu hẹp audience' }),
    );
    expect(out.tasks_created?.[0].task_id).toBe(42);
  });
});
