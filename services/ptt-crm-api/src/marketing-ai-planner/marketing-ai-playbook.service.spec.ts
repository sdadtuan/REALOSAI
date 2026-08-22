import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';

describe('MarketingAiPlaybookService', () => {
  const config = {
    mktAiPlannerEnabled: true,
    mktAiPlaybooksEnabled: true,
    mktAiGovernanceBanner: true,
    mktAiLaunchQaQualityGate: true,
    mktAiPlannerSlugs: ['meta-lead-gen'],
  } as AppConfigService;

  const repo = {
    getBrief: jest.fn(),
    getDraft: jest.fn(),
    upsertBrief: jest.fn(),
    ensureDraft: jest.fn(),
    upsertDraft: jest.fn(),
  } as unknown as MarketingAiPlannerRepository;

  const service = new MarketingAiPlaybookService(config, repo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('listForLifecycle filters pilot slugs', () => {
    const out = service.listForLifecycle('meta-lead-gen', null);
    expect(out.ok).toBe(true);
    expect(out.playbooks.some((p) => p.slug === 'meta-lead-gen')).toBe(true);
    expect(out.playbooks.some((p) => p.slug === 'seo-retainer')).toBe(false);
  });

  it('buildPromptHints returns strategy and campaign blocks', () => {
    const pb = service.getPlaybook('meta-lead-gen');
    const hints = service.buildPromptHints(pb);
    expect(hints.strategyBlock).toContain('Industry playbook hints');
    expect(hints.campaignBlock).toContain('CPL Meta');
  });

  it('checkLaunchQaQualityGate uses draft quality score', async () => {
    repo.getBrief = jest.fn().mockResolvedValue({
      brief_json: { _playbook_slug: 'meta-lead-gen', brand_name: 'X', challenges: 'Y', budget_monthly_vnd: 1_000_000 },
    });
    repo.getDraft = jest.fn().mockResolvedValue({
      strategy_framework: { target_market: 'abc' },
      target_market_prof: {
        segmentation_icp: 'x'.repeat(90),
        buy_triggers_obstacles: 'competition',
      },
      swot_json: {},
      campaigns_json: [
        { name: 'A', objective: 'lead', channel_mix: ['Meta', 'Google'], budget_pct: 50, kpis: ['CPL'] },
        { name: 'B', objective: 'lead', channel_mix: ['Meta', 'Landing'], budget_pct: 50, kpis: ['CTR'] },
      ],
      content_json: {},
      quality_score_json: {},
    });
    const gate = await service.checkLaunchQaQualityGate(1, 'meta-lead-gen');
    expect(gate.required).toBe(true);
    expect(gate.min_score).toBe(70);
    expect(typeof gate.current_score).toBe('number');
  });

  it('mergeAndPersistPlaybook upserts brief and draft metadata', async () => {
    repo.ensureDraft = jest.fn().mockResolvedValue({
      strategy_framework: {},
      target_market_prof: {},
      swot_json: {},
      campaigns_json: [],
      content_json: {},
      quality_score_json: {},
    });
    repo.upsertBrief = jest.fn().mockResolvedValue(undefined);
    repo.upsertDraft = jest.fn().mockResolvedValue(undefined);

    const out = await service.mergeAndPersistPlaybook({
      lifecycleId: 9,
      slug: 'meta-lead-gen',
      serviceSlug: 'meta-lead-gen',
      existingBrief: null,
      actorEmail: 'sp@test.vn',
    });
    expect(out.playbook_slug).toBe('meta-lead-gen');
    expect(repo.upsertBrief).toHaveBeenCalled();
    expect(repo.upsertDraft).toHaveBeenCalled();
  });
});
