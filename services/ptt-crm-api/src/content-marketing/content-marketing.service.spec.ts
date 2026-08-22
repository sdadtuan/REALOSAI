import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ContentMarketingService } from './content-marketing.service';

describe('ContentMarketingService', () => {
  const config = {
    contentMarketingEnabled: true,
    contentMarketingSlugs: ['tiep-thi-noi-dung'] as string[],
    contentMarketingAiEnabled: true,
    contentMarketingApprovalRequired: true,
    contentMarketingMediaEnabled: false,
    contentMarketingClientGate: false,
    contentMarketingFeEnabled: true,
  };

  const lifecycle = {
    detail: jest.fn(),
    context: jest.fn().mockResolvedValue({ contract: { agency_client_id: '' } }),
  };

  const repo = {
    getActiveSnapshotSummary: jest.fn(),
    getContextCounts: jest.fn(),
    loadPlannerSource: jest.fn().mockResolvedValue(null),
  };

  let service: ContentMarketingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentMarketingService(config as never, lifecycle as never, repo as never);
  });

  it('getContext throws when module disabled', async () => {
    const disabled = new ContentMarketingService(
      { ...config, contentMarketingEnabled: false } as never,
      lifecycle as never,
      repo as never,
    );
    lifecycle.detail.mockResolvedValue({ service_slug: 'tiep-thi-noi-dung', stage: 'deliver' });
    await expect(disabled.getContext(123)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getContext throws when slug not in pilot list', async () => {
    lifecycle.detail.mockResolvedValue({ service_slug: 'other-slug', stage: 'deliver' });
    await expect(service.getContext(123)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getContext returns counts and snapshot summary', async () => {
    lifecycle.detail.mockResolvedValue({ service_slug: 'tiep-thi-noi-dung', stage: 'deliver' });
    repo.getActiveSnapshotSummary.mockResolvedValue({
      id: 7,
      sealed: false,
      ingested_at: new Date('2026-08-09T04:00:00.000Z'),
      marketing_plan_id: 99,
      pillars_count: 3,
      source_hash: 'abc123',
      ingested_by: 'lead@test.vn',
      snapshot_json: {},
      brand_context_json: {},
    });
    repo.getContextCounts.mockResolvedValue({
      ideas: 5,
      items_by_status: { draft: 2, in_review: 1, published: 0 },
      draft: 2,
      in_review: 1,
      published_mtd: 0,
      scheduled_this_week: 3,
      in_review_sla_breach: 0,
    });

    const ctx = await service.getContext(123);
    expect(ctx.ok).toBe(true);
    expect(ctx.lifecycle_id).toBe(123);
    expect(ctx.snapshot?.pillars_count).toBe(3);
    expect(ctx.counts.ideas).toBe(5);
    expect(ctx.counts.draft).toBe(2);
    expect(ctx.flags.ai_enabled).toBe(true);
    expect(ctx.channel_defaults).toContain('facebook');
  });

  it('getContext works with empty snapshot and zero counts', async () => {
    lifecycle.detail.mockResolvedValue({ service_slug: 'tiep-thi-noi-dung', stage: 'onboard' });
    repo.getActiveSnapshotSummary.mockResolvedValue(null);
    repo.getContextCounts.mockResolvedValue({
      ideas: 0,
      items_by_status: { draft: 0 },
      draft: 0,
      in_review: 0,
      published_mtd: 0,
      scheduled_this_week: 0,
      in_review_sla_breach: 0,
    });

    const ctx = await service.getContext(456);
    expect(ctx.snapshot).toBeNull();
    expect(ctx.counts.ideas).toBe(0);
    expect(ctx.stage).toBe('onboard');
  });
});
