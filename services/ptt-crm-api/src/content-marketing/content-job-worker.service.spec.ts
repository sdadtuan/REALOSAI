import { ContentJobWorkerService } from './content-job-worker.service';

describe('ContentJobWorkerService', () => {
  const config = { mktAiModel: 'gpt-4o-mini', contentMarketingVideoProvider: 'stub' };
  const aiConfig = { llmApiKey: '', llmModel: 'gpt-4o-mini' };
  const llm = {
    completeJson: jest.fn().mockResolvedValue({
      parsed: { markdown: '# Draft\n\nBody text.' },
      tokenUsage: {},
      modelName: 'gpt-4o-mini',
      stubMode: true,
    }),
  };
  const agentRuns = { tableReady: jest.fn().mockResolvedValue(false), insertRun: jest.fn() };
  const repo = {
    claimContentJob: jest.fn(),
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn().mockResolvedValue(2),
    finishContentJob: jest.fn(),
  };
  const brandContext = {
    resolveForLifecycle: jest.fn().mockResolvedValue({ brand_name: 'Acme' }),
  };

  const mediaImages = {
    providerName: 'stub',
    generateImages: jest.fn().mockResolvedValue({
      assets: [
        {
          id: 'asset-1',
          type: 'image',
          url: 'https://cdn.pttads.vn/cmkt/1/5/asset-1.webp',
          ai_generated: true,
          provider: 'stub',
          selected: true,
          draft_watermark: true,
          clean_storage_key: '1/5/asset-1-clean.webp',
          prompt_hash: 'abc',
          storage_key: '1/5/asset-1.webp',
          visual_qa_score: 84,
          ocr_confidence: 0.8,
          brand_delta_e: 6,
        },
      ],
      qa: {
        score: 84,
        checks: { assets_present: true, dimensions_ok: true, brand_delta_e_ok: true, ocr_confidence_ok: true },
        blocked: false,
        brand_delta_e_max: 6,
        ocr_confidence: 0.8,
      },
    }),
  };
  const mediaVideo = {
    generateShortVideo: jest.fn(),
  };
  const visualQa = {
    scoreAssets: jest.fn().mockReturnValue({
      score: 84,
      checks: { assets_present: true, dimensions_ok: true },
      blocked: false,
    }),
  };
  const social = {
    executeStoryboard: jest.fn(),
    executeRender: jest.fn(),
    executeTranscode: jest.fn(),
    executeQa: jest.fn(),
  };

  let worker: ContentJobWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    worker = new ContentJobWorkerService(
      config as never,
      aiConfig as never,
      llm as never,
      agentRuns as never,
      repo as never,
      brandContext as never,
      mediaImages as never,
      mediaVideo as never,
      visualQa as never,
      social as never,
    );
  });

  it('processJob draft_generate updates item body', async () => {
    repo.claimContentJob.mockResolvedValue({
      id: 10,
      lifecycle_id: 1,
      item_id: 5,
      job_type: 'draft_generate',
      input_json: { tone: 'professional_friendly' },
      created_by: 'w@test.vn',
    });
    repo.getItemById.mockResolvedValue({
      id: 5,
      channel: 'facebook',
      format: 'social_post',
      title: 'Post',
      funnel_goal: 'engagement',
      brief_json: {},
      body_json: { markdown: '', variants: [] },
    });
    repo.finishContentJob.mockImplementation((_id, patch) => ({ id: 10, status: patch.status, output_json: patch.output_json }));

    const out = await worker.processJob(10);
    expect(repo.patchItem).toHaveBeenCalled();
    expect(repo.insertItemVersion).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ markdown: expect.stringContaining('Draft') }),
      'w@test.vn',
      'ai_generate',
      null,
    );
    expect(out?.status).toBe('succeeded');
  });

  it('does not reject visual_status when social_transcode fails after master exists', async () => {
    repo.claimContentJob.mockResolvedValue({
      id: 20,
      lifecycle_id: 1,
      item_id: 5,
      job_type: 'social_transcode',
      input_json: {},
      created_by: 'w@test.vn',
    });
    repo.getItemById.mockResolvedValue({
      id: 5,
      channel: 'short_video',
      format: 'video_script',
      title: 'Hook',
      body_json: { markdown: 'hook' },
      media_json: { video_short: { url: 'https://cdn.pttads.vn/cmkt/1/5/master.mp4' } },
    });
    social.executeTranscode.mockRejectedValue(new Error('ffmpeg_missing'));
    repo.finishContentJob.mockImplementation((_id, patch) => ({
      id: 20,
      status: patch.status,
      error_text: patch.error_text,
    }));

    const out = await worker.processJob(20);
    expect(out?.status).toBe('failed');
    expect(repo.patchItem).not.toHaveBeenCalledWith(
      1,
      5,
      expect.objectContaining({ visual_status: 'rejected' }),
    );
  });
});
