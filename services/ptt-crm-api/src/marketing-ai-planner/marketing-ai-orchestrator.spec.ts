import { MarketingAiOrchestratorService } from './marketing-ai-orchestrator.service';
import { MKT_AI_PROMPT_VERSION } from './marketing-ai-prompts';
import {
  normalizeCampaignsOutput,
  normalizeStrategyOutput,
} from './marketing-ai-orchestrator.util';
import type { MktAiBrief } from './marketing-ai-planner.types';

describe('MarketingAiOrchestratorService', () => {
  const brief: MktAiBrief = {
    brand_name: 'Acme Corp',
    industry: 'SaaS B2B',
    objective: 'lead',
    budget_monthly_vnd: 30_000_000,
    geo_markets: ['TP.HCM', 'Hà Nội'],
    challenges: 'CPL cao trên Meta',
    usp: 'Giải pháp tự động hóa sales',
    competitors: ['Competitor X'],
  };

  const config = { mktAiModel: 'gpt-4o-mini' };
  const aiConfig = { llmApiKey: '', llmModel: 'gpt-4o-mini' };
  const llm = { completeJson: jest.fn() };

  let orchestrator: MarketingAiOrchestratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new MarketingAiOrchestratorService(
      config as never,
      aiConfig as never,
      llm as never,
    );
  });

  it('exposes promptVersion v1-kit-port', () => {
    expect(orchestrator.promptVersion).toBe(MKT_AI_PROMPT_VERSION);
    expect(orchestrator.stubMode).toBe(true);
  });

  it('generateStrategy uses stub via completeJson when no API key', async () => {
    llm.completeJson.mockImplementation(async ({ stubJson }) => ({
      parsed: stubJson(),
      stubMode: true,
      modelName: 'gpt-4o-mini-stub',
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));

    const out = await orchestrator.generateStrategy(brief);

    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('strategy_framework'),
        userContent: expect.stringContaining('Acme Corp'),
      }),
    );
    expect(out.strategy_framework.target_market).toContain('Acme Corp');
    expect(out.target_market_prof.market_context).toBeTruthy();
    expect(out.swot_json.strengths.length).toBeGreaterThan(0);
  });

  it('generateStrategy injects rag block and preserves citations', async () => {
    llm.completeJson.mockImplementation(async ({ stubJson }) => ({
      parsed: stubJson(),
      stubMode: true,
      modelName: 'gpt-4o-mini-stub',
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));

    const ragCitations = {
      insights_evidence: [
        {
          chunk_id: 1,
          document_id: 2,
          filename: 'Brand-Guidelines.pdf',
          page_no: 4,
        },
      ],
    };

    const out = await orchestrator.generateStrategy(brief, {
      ragPromptBlock: '[1] Brand-Guidelines.pdf p.4: USP evidence',
      ragCitations,
    });

    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        userContent: expect.stringContaining('Brand-Guidelines.pdf p.4'),
      }),
    );
    expect(out.rag_citations?.insights_evidence?.[0].filename).toBe('Brand-Guidelines.pdf');
  });

  it('generateStrategy merges partial LLM JSON with stub fallback', async () => {
    llm.completeJson.mockResolvedValue({
      parsed: {
        strategy_framework: { target_market: 'LLM target market override' },
        target_market_prof: { market_context: 'LLM context' },
        swot_json: { strengths: ['LLM strength'] },
      },
      stubMode: false,
      modelName: 'gpt-4o-mini',
      tokenUsage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    });

    const stubOnly = await orchestrator.generateStrategy(brief);
    const merged = normalizeStrategyOutput(
      {
        strategy_framework: { target_market: 'LLM target market override' },
        target_market_prof: { market_context: 'LLM context' },
        swot_json: { strengths: ['LLM strength'] },
      },
      stubOnly,
    );

    expect(merged.strategy_framework.target_market).toBe('LLM target market override');
    expect(merged.strategy_framework.media_reach).toBeTruthy();
    expect(merged.target_market_prof.segmentation_icp).toBeTruthy();
    expect(merged.swot_json.strengths).toEqual(['LLM strength']);
  });

  it('generateCampaigns returns stub campaigns in stub mode', async () => {
    llm.completeJson.mockImplementation(async ({ stubJson }) => ({
      parsed: stubJson(),
      stubMode: true,
      modelName: 'gpt-4o-mini-stub',
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));

    const campaigns = await orchestrator.generateCampaigns(brief);

    expect(campaigns.length).toBeGreaterThanOrEqual(2);
    expect(campaigns[0].channel_mix.length).toBeGreaterThan(0);
    expect(campaigns[0].budget_pct).toBeGreaterThan(0);
  });

  it('normalizeCampaignsOutput falls back when LLM returns empty', () => {
    const fallback = [
      {
        name: 'Stub',
        objective: 'lead',
        channel_mix: ['Meta'],
        budget_pct: 50,
        milestones: ['Launch'],
        kpis: ['CPL'],
      },
    ];
    expect(normalizeCampaignsOutput({}, fallback)).toEqual(fallback);
    expect(normalizeCampaignsOutput({ campaigns: [] }, fallback)).toEqual(fallback);
  });

  it('generateContent produces calendar and assets in stub mode', async () => {
    llm.completeJson.mockImplementation(async ({ stubJson }) => ({
      parsed: stubJson(),
      stubMode: true,
      modelName: 'gpt-4o-mini-stub',
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));

    const campaigns = await orchestrator.generateCampaigns(brief);
    const out = await orchestrator.generateContent(brief, campaigns);

    expect(Array.isArray(out.content_json.calendar)).toBe(true);
    expect(out.assets.length).toBeGreaterThan(0);
    expect(out.assets[0].body_text).toBeTruthy();
  });

  it('generateOptimizeRecommendations returns rule-based recs in stub mode', async () => {
    llm.completeJson.mockImplementation(async ({ stubJson }) => ({
      parsed: stubJson(),
      stubMode: true,
      modelName: 'gpt-4o-mini-stub',
      tokenUsage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    }));

    const dashboard = {
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

    const recs = await orchestrator.generateOptimizeRecommendations({
      dashboard,
      brief,
      campaigns: [],
      lifecycleStage: 'deliver',
    });

    expect(recs.length).toBeGreaterThanOrEqual(3);
    expect(llm.completeJson).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: expect.stringContaining('BR-MKTP-01'),
      }),
    );
  });
});
