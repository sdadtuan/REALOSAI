import { ContentMarketingController } from './content-marketing.controller';

describe('ContentMarketingController', () => {
  const contentMarketing = { getContext: jest.fn() };
  const ideas = {
    listIdeas: jest.fn(),
    createIdea: jest.fn(),
    patchIdea: jest.fn(),
    convertIdea: jest.fn(),
    startBulkIdeasJob: jest.fn(),
  };
  const items = {
    listItems: jest.fn(),
    getItem: jest.fn(),
    createItem: jest.fn(),
    patchItem: jest.fn(),
    publishItem: jest.fn(),
  };
  const snapshots = {
    getPlanSnapshot: jest.fn(),
    ingestPlanSnapshot: jest.fn(),
    sealPlanSnapshot: jest.fn(),
  };
  const generate = {
    startDraftJob: jest.fn(),
    startVariantsJob: jest.fn(),
    getJob: jest.fn(),
    cancelJob: jest.fn(),
  };
  const workflow = {
    submitReview: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    submitToClient: jest.fn(),
    clientApprove: jest.fn(),
    clientReject: jest.fn(),
    listReviewQueue: jest.fn(),
    reviewQueueSummary: jest.fn(),
  };
  const calendar = { listCalendar: jest.fn(), upsertSlot: jest.fn(), deleteSlot: jest.fn() };
  const audit = { listAudit: jest.fn() };
  const comments = { listComments: jest.fn(), addComment: jest.fn() };
  const repurpose = { repurpose: jest.fn(), listDerivations: jest.fn() };
  const seoBridge = { bridgeSeo: jest.fn(), getSeoBridgeStatus: jest.fn() };
  const emailBridge = { bridgeEmail: jest.fn(), getEmailBridgeStatus: jest.fn() };
  const production = {
    getProduction: jest.fn(),
    patchProduction: jest.fn(),
    markProductionDone: jest.fn(),
    linkCreative: jest.fn(),
    exportDesignBrief: jest.fn(),
    exportDesignBriefPdf: jest.fn(),
    exportScript: jest.fn(),
  };
  const media = {
    startImageJob: jest.fn(),
    startCarouselSlidesJob: jest.fn(),
    startVisualQaJob: jest.fn(),
    startVideoShortJob: jest.fn(),
    startStoryboard: jest.fn(),
    patchStoryboard: jest.fn(),
    startRender: jest.fn(),
    startTranscode: jest.fn(),
    startVideoQa: jest.fn(),
    lockStudio: jest.fn(),
    selectMediaAsset: jest.fn(),
  };
  const visual = {
    listVisualReviewQueue: jest.fn(),
    submitVisualReview: jest.fn(),
    approveVisual: jest.fn(),
    rejectVisual: jest.fn(),
    escalateHuman: jest.fn(),
  };
  const metrics = {
    listItemMetrics: jest.fn(),
    createMetric: jest.fn(),
    patchMetric: jest.fn(),
  };
  const intelligence = {
    getIntelligence: jest.fn(),
    getMetricsSummary: jest.fn(),
    getSuggestions: jest.fn(),
    startTopicSuggestJob: jest.fn(),
  };
  const pillars = { listPillars: jest.fn(), patchPillar: jest.fn() };
  const seoBridgeSync = { syncPublishedUrlFromSeo: jest.fn(), getSeoBridgeStatusWithSync: jest.fn() };
  const staffAuth = { resolveStaffIdFromJwt: jest.fn() };

  let controller: ContentMarketingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentMarketingController(
      contentMarketing as never,
      ideas as never,
      items as never,
      snapshots as never,
      generate as never,
      workflow as never,
      calendar as never,
      audit as never,
      comments as never,
      repurpose as never,
      seoBridge as never,
      emailBridge as never,
      production as never,
      media as never,
      visual as never,
      metrics as never,
      intelligence as never,
      pillars as never,
      seoBridgeSync as never,
      staffAuth as never,
    );
  });

  it('GET context delegates to service', async () => {
    contentMarketing.getContext.mockResolvedValue({ lifecycle_id: 123, ok: true });
    await expect(controller.context(123)).resolves.toEqual({ lifecycle_id: 123, ok: true });
    expect(contentMarketing.getContext).toHaveBeenCalledWith(123);
  });

  it('GET ideas delegates to idea service', async () => {
    ideas.listIdeas.mockResolvedValue({ ideas: [] });
    await expect(controller.listIdeas(123, 'backlog', undefined)).resolves.toEqual({ ideas: [] });
    expect(ideas.listIdeas).toHaveBeenCalledWith(123, { status: 'backlog', pillar_id: undefined });
  });

  it('POST plan-snapshot/ingest delegates to snapshot service', async () => {
    snapshots.ingestPlanSnapshot.mockResolvedValue({ ok: true, ideas_created: 5 });
    const req = { staffUser: { email: 'lead@test.vn' } } as never;
    await expect(
      controller.ingestPlanSnapshot(123, { mode: 'merge' }, req),
    ).resolves.toEqual({ ok: true, ideas_created: 5 });
    expect(snapshots.ingestPlanSnapshot).toHaveBeenCalledWith(
      123,
      { mode: 'merge' },
      'lead@test.vn',
    );
  });

  it('POST items/:id/jobs/draft delegates to generate service', async () => {
    generate.startDraftJob.mockResolvedValue({ id: 9, status: 'succeeded' });
    const req = { staffUser: { email: 'writer@test.vn' } } as never;
    await expect(controller.startDraftJob(123, 42, { tone: 'bold' }, req)).resolves.toEqual({
      id: 9,
      status: 'succeeded',
    });
    expect(generate.startDraftJob).toHaveBeenCalledWith(123, 42, { tone: 'bold' }, 'writer@test.vn');
  });

  it('POST submit-review delegates to workflow service', async () => {
    workflow.submitReview.mockResolvedValue({ id: 42, status: 'in_review' });
    const req = { staffUser: { email: 'sp@test.vn' } } as never;
    await expect(controller.submitReview(123, 42, req)).resolves.toEqual({ id: 42, status: 'in_review' });
    expect(workflow.submitReview).toHaveBeenCalledWith(123, 42, 'sp@test.vn');
  });

  it('GET pillars delegates to pillar service', async () => {
    pillars.listPillars.mockResolvedValue({ pillars: [{ id: 1, name: 'Launch' }] });
    await expect(controller.listPillars(123)).resolves.toEqual({ pillars: [{ id: 1, name: 'Launch' }] });
    expect(pillars.listPillars).toHaveBeenCalledWith(123);
  });

  it('PATCH pillars/:id delegates to pillar service', async () => {
    pillars.patchPillar.mockResolvedValue({ pillar: { id: 2, name: 'Trust' } });
    await expect(controller.patchPillar(123, 2, { name: 'Trust' })).resolves.toEqual({
      pillar: { id: 2, name: 'Trust' },
    });
    expect(pillars.patchPillar).toHaveBeenCalledWith(123, 2, { name: 'Trust' });
  });

  it('POST jobs/ideas-bulk delegates to idea service', async () => {
    ideas.startBulkIdeasJob.mockResolvedValue({ id: 77, status: 'succeeded', job_type: 'ideas_bulk' });
    const req = { staffUser: { email: 'lead@test.vn' } } as never;
    await expect(controller.startIdeasBulkJob(123, { idea_count: 30 }, req)).resolves.toEqual({
      id: 77,
      status: 'succeeded',
      job_type: 'ideas_bulk',
    });
    expect(ideas.startBulkIdeasJob).toHaveBeenCalledWith(123, { idea_count: 30 }, 'lead@test.vn');
  });

  it('POST export brief-design/pdf delegates to production service', async () => {
    production.exportDesignBriefPdf.mockResolvedValue({
      ok: true,
      filename: 'creative-brief-42.pdf',
      content_base64: 'JVBERi0=',
      content_type: 'application/pdf',
    });
    await expect(controller.exportDesignBriefPdf(123, 42)).resolves.toEqual({
      ok: true,
      filename: 'creative-brief-42.pdf',
      content_base64: 'JVBERi0=',
      content_type: 'application/pdf',
    });
    expect(production.exportDesignBriefPdf).toHaveBeenCalledWith(123, 42);
  });

  it('POST bridge/seo/sync delegates to seo bridge sync service', async () => {
    seoBridgeSync.syncPublishedUrlFromSeo.mockResolvedValue({
      synced: true,
      item: { id: 42, published_url: '/blog/smoke-post' },
      published_url: '/blog/smoke-post',
    });
    const req = { staffUser: { email: 'seo@test.vn' } } as never;
    await expect(controller.syncSeoPublishedUrl(123, 42, req)).resolves.toEqual({
      synced: true,
      item: { id: 42, published_url: '/blog/smoke-post' },
      published_url: '/blog/smoke-post',
    });
    expect(seoBridgeSync.syncPublishedUrlFromSeo).toHaveBeenCalledWith(123, 42, 'seo@test.vn');
  });

  it('POST submit-client delegates to workflow service', async () => {
    workflow.submitToClient.mockResolvedValue({ id: 42, status: 'pending_client' });
    const req = { staffUser: { email: 'am@test.vn' } } as never;
    await expect(controller.submitToClient(123, 42, req)).resolves.toEqual({
      id: 42,
      status: 'pending_client',
    });
    expect(workflow.submitToClient).toHaveBeenCalledWith(123, 42, 'am@test.vn');
  });

  it('POST jobs/video-short delegates to media service', async () => {
    media.startVideoShortJob.mockResolvedValue({ id: 88, status: 'succeeded', job_type: 'video_short_generate' });
    const req = { staffUser: { email: 'writer@test.vn' } } as never;
    await expect(controller.startVideoShortJob(123, 42, { aspect_ratio: '9:16' }, req)).resolves.toEqual({
      id: 88,
      status: 'succeeded',
      job_type: 'video_short_generate',
    });
    expect(media.startVideoShortJob).toHaveBeenCalledWith(
      123,
      42,
      { aspect_ratio: '9:16' },
      'writer@test.vn',
    );
  });

  it('POST jobs/video-storyboard delegates to media service', async () => {
    media.startStoryboard.mockResolvedValue({ id: 91, status: 'queued', job_type: 'social_storyboard' });
    const req = { staffUser: { email: 'writer@test.vn' } } as never;
    await expect(controller.startStoryboard(123, 42, { pack_default: 'reels' }, req)).resolves.toEqual({
      id: 91,
      status: 'queued',
      job_type: 'social_storyboard',
    });
    expect(media.startStoryboard).toHaveBeenCalledWith(
      123,
      42,
      { pack_default: 'reels' },
      'writer@test.vn',
    );
  });

  it('POST jobs/video-render delegates to media service', async () => {
    media.startRender.mockResolvedValue({ id: 92, status: 'queued', job_type: 'social_render' });
    const req = { staffUser: { email: 'writer@test.vn' } } as never;
    await expect(controller.startRender(123, 42, {}, req)).resolves.toEqual({
      id: 92,
      status: 'queued',
      job_type: 'social_render',
    });
    expect(media.startRender).toHaveBeenCalledWith(123, 42, {}, 'writer@test.vn');
  });
});
