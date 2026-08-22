import { BadRequestException } from '@nestjs/common';
import { ContentGenerateService } from './content-generate.service';

describe('ContentGenerateService', () => {
  const config = {
    contentMarketingAiEnabled: true,
    contentMarketingBriefGateEnabled: true,
  };
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue({ service_slug: 'tiep-thi-noi-dung' }) };
  const brandContext = {
    resolveForLifecycle: jest.fn().mockResolvedValue({
      brand_name: 'Brand',
      audience: 'B2B',
      pii_consent: false,
    }),
  };
  const repo = {
    getItemById: jest.fn(),
    createContentJob: jest.fn(),
  };
  const worker = { processJob: jest.fn() };

  let service: ContentGenerateService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContentGenerateService(
      config as never,
      core as never,
      brandContext as never,
      repo as never,
      worker as never,
    );
  });

  it('rejects when AI disabled', async () => {
    const off = new ContentGenerateService(
      { contentMarketingAiEnabled: false, contentMarketingBriefGateEnabled: true } as never,
      core as never,
      brandContext as never,
      repo as never,
      worker as never,
    );
    await expect(off.startDraftJob(1, 2, {}, 'w@test.vn')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects brief_incomplete when audience/goal missing', async () => {
    brandContext.resolveForLifecycle.mockResolvedValue({ audience: '', pii_consent: false });
    repo.getItemById.mockResolvedValue({
      id: 2,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      funnel_goal: '',
      title: 'T',
      brief_json: {},
      body_json: { markdown: '', variants: [] },
    });
    await expect(service.startDraftJob(1, 2, {}, 'w@test.vn')).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'brief_incomplete' }),
    });
  });

  it('startDraftJob creates and processes job', async () => {
    repo.getItemById.mockResolvedValue({
      id: 2,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      funnel_goal: 'engagement',
      title: 'T',
      brief_json: { audience: 'B2B' },
      body_json: { markdown: '', variants: [] },
    });
    repo.createContentJob.mockResolvedValue({ id: 99, status: 'queued' });
    worker.processJob.mockResolvedValue({ id: 99, status: 'succeeded', output_json: { version_no: 2 } });

    const out = await service.startDraftJob(1, 2, { tone: 'bold' }, 'w@test.vn');
    expect(out.status).toBe('succeeded');
    expect(worker.processJob).toHaveBeenCalledWith(99);
  });

  it('startRegenerateJob requires existing body', async () => {
    repo.getItemById.mockResolvedValue({
      id: 2,
      status: 'draft',
      funnel_goal: 'engagement',
      brief_json: { audience: 'B2B' },
      body_json: { markdown: '', variants: [] },
    });
    await expect(
      service.startRegenerateJob(1, 2, { reason: 'sai tone' }, 'w@test.vn'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'regenerate_body_required' }),
    });
  });

  it('startRegenerateJob creates regenerate job', async () => {
    repo.getItemById.mockResolvedValue({
      id: 2,
      status: 'draft',
      channel: 'facebook',
      format: 'social_post',
      funnel_goal: 'engagement',
      title: 'T',
      brief_json: { audience: 'B2B' },
      body_json: { markdown: '# Old draft', variants: [] },
    });
    repo.createContentJob.mockResolvedValue({ id: 100, status: 'queued', job_type: 'regenerate' });
    worker.processJob.mockResolvedValue({ id: 100, status: 'succeeded', output_json: { version_no: 3 } });

    const out = await service.startRegenerateJob(
      1,
      2,
      { mode: 'rewrite', reason: 'sai tone' },
      'w@test.vn',
    );
    expect(out.status).toBe('succeeded');
    expect(repo.createContentJob).toHaveBeenCalledWith(
      expect.objectContaining({ job_type: 'regenerate' }),
    );
  });
});
