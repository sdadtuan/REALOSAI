import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

describe('MarketingAiPlannerService', () => {
  const config = {
    mktAiPlannerEnabled: true,
    mktAiPlannerSlugs: [] as string[],
    mktAiRagEnabled: false,
  };
  const lifecycle = {
    detail: jest.fn(),
    consultBrief: jest.fn(),
    onboardingBrief: jest.fn(),
    marketingPlan: jest.fn(),
    patchMarketingPlan: jest.fn(),
  };
  const repo = {
    getBrief: jest.fn(),
    upsertBrief: jest.fn(),
    getDraft: jest.fn(),
    ensureDraft: jest.fn(),
    upsertDraft: jest.fn(),
    listJobs: jest.fn(),
    createJob: jest.fn(),
    finishJob: jest.fn(),
    replaceCampaigns: jest.fn(),
    replaceContentAssets: jest.fn(),
    createExport: jest.fn(),
    listBudgetScenarios: jest.fn().mockResolvedValue([]),
  };
  const orchestrator = {
    stubMode: true,
    modelName: 'gpt-4o-mini',
    promptVersion: 'v1-kit-port',
    generateStrategy: jest.fn(),
    generateCampaigns: jest.fn(),
    generateContent: jest.fn(),
  };
  const agentRuns = {
    tableReady: jest.fn().mockResolvedValue(false),
    insertRun: jest.fn(),
  };
  const exportService = {
    buildExport: jest.fn(),
  };
  const rag = {
    isFeatureEnabled: jest.fn().mockReturnValue(false),
    listDocuments: jest.fn().mockResolvedValue([]),
    shouldUseRag: jest.fn().mockReturnValue(false),
    buildForStrategy: jest.fn(),
    attachCitations: jest.fn(),
    uploadDocument: jest.fn(),
  };
  const budget = {
    simulate: jest.fn(),
    applyScenario: jest.fn(),
  };
  const approval = {
    isFeatureEnabled: jest.fn().mockReturnValue(false),
    buildContext: jest.fn().mockResolvedValue({
      approval: { required: false, latest: null, can_export: true, can_submit: false },
      comments: [],
    }),
    assertExportAllowed: jest.fn(),
  };
  const versions = {
    listVersions: jest.fn().mockResolvedValue([]),
    summarizeVersions: jest.fn().mockReturnValue([]),
  };

  let service: MarketingAiPlannerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiPlannerService(
      config as never,
      lifecycle as never,
      repo as never,
      orchestrator as never,
      rag as never,
      budget as never,
      approval as never,
      versions as never,
      agentRuns as never,
      exportService as never,
    );
    lifecycle.detail.mockResolvedValue({
      id: 123,
      stage: 'onboard',
      service_slug: 'meta-lead-gen',
    });
    lifecycle.marketingPlan.mockResolvedValue({
      plan: { id: 1 },
      validation: { ok: false, messages: ['Thiếu ICP'] },
      filled_count: 4,
    });
    repo.listJobs.mockResolvedValue([]);
    repo.getDraft.mockResolvedValue(null);
    repo.getBrief.mockResolvedValue(null);
    rag.buildForStrategy.mockResolvedValue({
      enabled: false,
      query: '',
      chunks: [],
      promptBlock: '',
    });
  });

  it('getContext throws when planner disabled', async () => {
    const disabled = new MarketingAiPlannerService(
      { mktAiPlannerEnabled: false, mktAiPlannerSlugs: [], mktAiRagEnabled: false } as never,
      lifecycle as never,
      repo as never,
      orchestrator as never,
      rag as never,
      budget as never,
      approval as never,
      versions as never,
      agentRuns as never,
      exportService as never,
    );
    await expect(disabled.getContext(123)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('applyToTmmt maps missing official plan to 409 Conflict', async () => {
    repo.ensureDraft.mockResolvedValue({
      strategy_framework: { target_market: 'SMB' },
      target_market_prof: {
        market_context: 'ctx',
        segmentation_icp: 'icp long enough for quality score validation in unit test',
        personas_roles: 'persona',
        pains_desired_outcomes: 'pain',
      },
      campaigns_json: [{ name: 'c1', objective: 'lead', channel_mix: ['Meta', 'Google'], budget_pct: 50, kpis: ['CPL'] }],
      content_json: {},
      swot_json: {},
      quality_score_json: {},
    });
    repo.getBrief.mockResolvedValue({
      brief_json: {
        brand_name: 'Acme',
        industry: 'B2B',
        service_slug: 'meta-lead-gen',
        objective: 'lead',
        budget_monthly_vnd: 20000000,
        geo_markets: ['VN'],
        challenges: 'CPL cao',
      },
      prefill_sources_json: [],
      updated_by: 'sp@test.vn',
    });
    lifecycle.patchMarketingPlan.mockRejectedValue(
      new NotFoundException({ error: 'Chưa có Kế hoạch MKT chính thức' }),
    );

    await expect(
      service.applyToTmmt(123, { confirm_overwrite: true }, 'sp@test.vn'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('runStrategyJob audits agent run when table ready', async () => {
    agentRuns.tableReady.mockResolvedValue(true);
    repo.getBrief.mockResolvedValue({
      brief_json: {
        brand_name: 'Acme',
        industry: 'B2B',
        service_slug: 'meta-lead-gen',
        objective: 'lead',
        budget_monthly_vnd: 20000000,
        geo_markets: ['VN'],
        challenges: 'CPL cao',
      },
      prefill_sources_json: [],
      updated_by: 'sp@test.vn',
    });
    repo.createJob.mockResolvedValue({ id: 99 });
    repo.ensureDraft.mockResolvedValue({
      strategy_framework: {},
      target_market_prof: {},
      swot_json: {},
      campaigns_json: [],
      content_json: {},
      quality_score_json: {},
    });
    orchestrator.generateStrategy.mockResolvedValue({
      strategy_framework: { target_market: 'SMB' },
      target_market_prof: { market_context: 'ctx' },
      swot_json: {},
    });

    await service.runStrategyJob(123, 'sp@test.vn');

    expect(agentRuns.insertRun).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: 'mkt_ai_planner',
        useCase: 'strategy_generate',
        status: 'succeeded',
      }),
    );
  });

  it('getContext prefill includes promoted official marketing plan', async () => {
    lifecycle.consultBrief.mockRejectedValue(new Error('no consult'));
    lifecycle.onboardingBrief.mockRejectedValue(new Error('no onboard'));
    lifecycle.marketingPlan.mockResolvedValue({
      plan: {
        north_star: 'ROAS 3x',
        objectives: 'Tăng lead chất lượng',
        strategy_framework: {
          target_market: 'Spa cao cấp',
          market_message: 'Premium experience',
          media_reach: 'Meta + Google',
          conversion_strategy: 'Landing page',
        },
      },
      validation: { ok: true, messages: [] },
      filled_count: 2,
    });

    const ctx = await service.getContext(123);

    expect(ctx.prefill_sources).toContain('presales-l1-plan');
    expect(ctx.prefill_sources).toContain('l1-consult-bridge');
    expect(ctx.brief?.challenges).toBe('Spa cao cấp');
    expect(ctx.brief?.usp).toBe('Premium experience');
    expect(ctx.brief?.notes).toContain('ROAS 3x');
  });

  it('exportPlan rejects score below 60', async () => {
    repo.getDraft.mockResolvedValue({
      strategy_framework: {},
      target_market_prof: {},
      swot_json: {},
      campaigns_json: [],
      content_json: {},
      quality_score_json: {},
    });
    repo.getBrief.mockResolvedValue(null);
    lifecycle.detail.mockResolvedValue({
      id: 123,
      stage: 'onboard',
      service_slug: 'meta-lead-gen',
    });

    await expect(service.exportPlan(123, 'pdf', 'sp@test.vn')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('exportPlan enforces docx-only when score 60-69', async () => {
    repo.getDraft.mockResolvedValue({
      strategy_framework: { target_market: 'SMB' },
      target_market_prof: {
        market_context: 'ctx',
        segmentation_icp: 'short icp',
        personas_roles: 'persona',
      },
      swot_json: {},
      campaigns_json: [
        { name: 'c1', objective: 'lead', channel_mix: ['Meta', 'Google'], budget_pct: 50, kpis: ['CPL'] },
      ],
      content_json: {},
      quality_score_json: {},
    });
    repo.getBrief.mockResolvedValue({
      brief_json: {
        brand_name: 'Acme',
        industry: 'B2B',
        service_slug: 'meta-lead-gen',
        objective: 'lead',
        budget_monthly_vnd: 20000000,
        geo_markets: ['VN'],
        challenges: 'CPL cao',
      },
      prefill_sources_json: [],
      updated_by: 'sp@test.vn',
    });

    await expect(service.exportPlan(123, 'pdf', 'sp@test.vn')).rejects.toMatchObject({
      response: { error: 'export_docx_only' },
    });
  });
});
