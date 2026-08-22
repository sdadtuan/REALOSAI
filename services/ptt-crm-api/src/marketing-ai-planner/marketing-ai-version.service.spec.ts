import { NotFoundException } from '@nestjs/common';
import { MarketingAiVersionService } from './marketing-ai-version.service';

describe('MarketingAiVersionService', () => {
  const repo = {
    listPlanVersions: jest.fn(),
    getPlanVersion: jest.fn(),
    getDraft: jest.fn(),
    upsertDraft: jest.fn(),
    replaceCampaigns: jest.fn(),
    replaceContentAssets: jest.fn(),
    getBrief: jest.fn(),
    upsertBrief: jest.fn(),
  };

  let service: MarketingAiVersionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiVersionService(repo as never);
  });

  it('restoreVersionToDraft writes draft only', async () => {
    repo.getPlanVersion.mockResolvedValue({
      id: 3,
      lifecycle_id: 1,
      version_no: 2,
      label: 'v2',
      status: 'approved',
      brief_json: {},
      strategy_framework_json: { market_context: 'ctx' },
      target_market_prof_json: { segmentation_icp: 'icp' },
      campaigns_json: [],
      content_json: {},
      quality_score_json: {},
      marketing_plan_id: null,
      applied_at: null,
      created_by: 'sp@test.vn',
      created_at: '2026-01-01',
    });
    repo.getDraft.mockResolvedValue({ swot_json: { s: 1 } });

    const out = await service.restoreVersionToDraft(1, 3, 'sp@test.vn');
    expect(repo.upsertDraft).toHaveBeenCalled();
    expect(repo.replaceCampaigns).toHaveBeenCalled();
    expect(out.draft.strategy_framework.market_context).toBe('ctx');
  });

  it('getVersion 404 when lifecycle mismatch', async () => {
    repo.getPlanVersion.mockResolvedValue({ id: 1, lifecycle_id: 99 });
    await expect(service.getVersion(1, 1)).rejects.toBeInstanceOf(NotFoundException);
  });
});
