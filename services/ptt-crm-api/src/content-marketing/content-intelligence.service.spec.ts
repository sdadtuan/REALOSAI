import { ContentIntelligenceService } from './content-intelligence.service';

describe('ContentIntelligenceService', () => {
  const core = { ensureLifecycleEnabled: jest.fn() };
  const repo = {
    listLifecycleMetricsInRange: jest.fn(),
    countPublishedItemsByChannel: jest.fn(),
    getLatestTopicSuggestions: jest.fn(),
    getLatestWeeklyMemo: jest.fn(),
    createContentJob: jest.fn(),
    createIdea: jest.fn(),
    listPillars: jest.fn(),
  };
  const brandContext = { resolveForLifecycle: jest.fn() };
  const worker = { processJob: jest.fn() };
  const externalMetrics = {
    collect: jest.fn(),
  };

  let svc: ContentIntelligenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new ContentIntelligenceService(
      core as never,
      repo as never,
      brandContext as never,
      worker as never,
      externalMetrics as never,
    );
    repo.listLifecycleMetricsInRange.mockResolvedValue([
      {
        id: 1,
        item_id: 5,
        channel: 'facebook',
        metric_date: '2026-08-09',
        impressions: 200,
        engagements: 20,
        clicks: 4,
        leads: 1,
        source: 'manual',
        raw_json: {},
        created_at: new Date().toISOString(),
        item_title: 'Post A',
        item_status: 'published',
      },
    ]);
    repo.countPublishedItemsByChannel.mockResolvedValue({ facebook: 1 });
    repo.getLatestTopicSuggestions.mockResolvedValue(['Suggestion cached']);
    repo.getLatestWeeklyMemo.mockResolvedValue(null);
    externalMetrics.collect.mockResolvedValue({ enabled: false, sources: [], by_channel: {} });
  });

  it('getIntelligence reflects metric rows', async () => {
    const out = await svc.getIntelligence(1, '30d');
    expect(out.metrics_count).toBe(1);
    expect(out.by_channel.facebook.engagements).toBe(20);
    expect(out.suggestions).toEqual(['Suggestion cached']);
  });

  it('startTopicSuggestJob runs worker', async () => {
    repo.createContentJob.mockResolvedValue({ id: 99, status: 'queued', job_type: 'topic_suggest' });
    worker.processJob.mockResolvedValue({
      id: 99,
      status: 'succeeded',
      output_json: { suggestions: ['Topic 1'] },
    });
    const job = await svc.startTopicSuggestJob(1, { range: '30d' }, 'lead@test.vn');
    expect(repo.createContentJob).toHaveBeenCalledWith(
      expect.objectContaining({ job_type: 'topic_suggest', item_id: null }),
    );
    expect(worker.processJob).toHaveBeenCalledWith(99);
    expect(job.status).toBe('succeeded');
  });

  it('startWeeklyMemoJob runs worker', async () => {
    repo.createContentJob.mockResolvedValue({ id: 100, status: 'queued', job_type: 'weekly_memo' });
    worker.processJob.mockResolvedValue({
      id: 100,
      status: 'succeeded',
      output_json: { memo: { title: 'Memo', body_vi: 'Body' } },
    });
    const job = await svc.startWeeklyMemoJob(1, { range: '7d' }, 'lead@test.vn');
    expect(repo.createContentJob).toHaveBeenCalledWith(
      expect.objectContaining({ job_type: 'weekly_memo', item_id: null }),
    );
    expect(job.status).toBe('succeeded');
  });

  it('applySuggestions creates ideas from indices', async () => {
    repo.listPillars.mockResolvedValue([{ id: 3, name: 'Launch' }]);
    repo.createIdea.mockResolvedValue({ id: 501, title: 'Idea' });
    const out = await svc.applySuggestions(
      1,
      { suggestion_indices: [0], leader_confirm: false },
      'lead@test.vn',
    );
    expect(out.ideas_created).toBe(1);
    expect(repo.createIdea).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ source: 'intelligence' }),
    );
  });
});
