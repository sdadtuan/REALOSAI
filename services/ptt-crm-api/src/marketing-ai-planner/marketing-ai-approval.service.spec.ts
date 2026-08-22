import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MarketingAiApprovalService } from './marketing-ai-approval.service';

describe('MarketingAiApprovalService', () => {
  const config = {
    mktAiApprovalRequired: true,
    mktAiApproverNotifyUserIds: [] as string[],
  };
  const repo = {
    getLatestApproval: jest.fn(),
    getPendingApproval: jest.fn(),
    listComments: jest.fn().mockResolvedValue([]),
    getBrief: jest.fn(),
    ensureDraft: jest.fn(),
    getNextPlanVersionNo: jest.fn(),
    createPlanVersion: jest.fn(),
    createApproval: jest.fn(),
    listApprovals: jest.fn(),
    decideApproval: jest.fn(),
    updatePlanVersionStatus: jest.fn(),
    createComment: jest.fn(),
  };
  const notifications = { createMany: jest.fn() };

  let service: MarketingAiApprovalService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MarketingAiApprovalService(
      config as never,
      repo as never,
      notifications as never,
    );
    repo.getPendingApproval.mockResolvedValue(null);
    repo.getLatestApproval.mockResolvedValue(null);
    repo.getBrief.mockResolvedValue({
      brief_json: {
        brand_name: 'Acme',
        challenges: 'Need leads',
        budget_monthly_vnd: 10_000_000,
        competitors: ['Rival'],
      },
    });
    repo.ensureDraft.mockResolvedValue({
      strategy_framework: {
        market_context: 'x',
        target_market: 'B2B SaaS',
      },
      target_market_prof: {
        segmentation_icp: 'A'.repeat(80),
        personas_roles: 'persona',
        pains_desired_outcomes: 'pain',
        buying_journey: 'journey',
        insights_evidence: 'evidence',
        buy_triggers_obstacles: 'triggers',
      },
      campaigns_json: [
        {
          name: 'C1',
          objective: 'lead',
          channel_mix: ['Meta', 'Google'],
          budget_pct: 100,
          kpis: ['CPL'],
        },
      ],
      content_json: { calendar: [] },
      quality_score_json: { score: 72 },
      swot_json: {},
    });
    repo.getNextPlanVersionNo.mockResolvedValue(1);
    repo.createPlanVersion.mockResolvedValue({ id: 10, version_no: 1, label: 'v1' });
    repo.createApproval.mockResolvedValue({
      id: 5,
      status: 'pending',
      plan_version_id: 10,
      plan_version: { id: 10, version_no: 1, label: 'v1' },
    });
  });

  it('submit rejects when workflow disabled', async () => {
    const off = new MarketingAiApprovalService(
      { mktAiApprovalRequired: false, mktAiApproverNotifyUserIds: [] } as never,
      repo as never,
      notifications as never,
    );
    await expect(off.submitForApproval(1, 'sp@test.vn', {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('submit rejects when pending exists', async () => {
    repo.getPendingApproval.mockResolvedValue({ id: 99 });
    await expect(service.submitForApproval(1, 'sp@test.vn', {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('submit creates version and approval', async () => {
    const out = await service.submitForApproval(1, 'sp@test.vn', { label: 'Pilot' });
    expect(repo.createPlanVersion).toHaveBeenCalled();
    expect(repo.createApproval).toHaveBeenCalled();
    expect(out.approval.id).toBe(5);
  });

  it('assertExportAllowed blocks without approval', () => {
    expect(() => service.assertExportAllowed(true, 'pending')).toThrow(BadRequestException);
    expect(() => service.assertExportAllowed(true, 'approved')).not.toThrow();
  });
});
