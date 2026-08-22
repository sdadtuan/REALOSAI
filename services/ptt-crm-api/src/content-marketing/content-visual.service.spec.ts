import { ContentVisualService } from './content-visual.service';

describe('ContentVisualService.approveVisual', () => {
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue(undefined) };
  const repo = {
    getItemById: jest.fn(),
    patchItem: jest.fn(),
    insertItemVersion: jest.fn(),
  };
  const mediaClean = {
    promoteMediaJson: jest.fn(async (media: unknown) => media),
  };

  let svc: ContentVisualService;

  beforeEach(() => {
    jest.clearAllMocks();
    core.ensureLifecycleEnabled.mockResolvedValue(undefined);
    mediaClean.promoteMediaJson.mockImplementation(async (media: unknown) => media);
    svc = new ContentVisualService(core as never, repo as never, mediaClean as never);
  });

  it('rejects social item with video_qa.blocked without override', async () => {
    repo.getItemById.mockResolvedValue({
      id: 2,
      format: 'video_script',
      channel: 'short_video',
      status: 'approved_internal',
      visual_status: 'ai_ready',
      media_json: {
        video_studio: 'social',
        video_qa: { score: 20, blocked: true, checks: {} },
        video_short: { id: 'video-9', type: 'video', url: 'https://cdn.pttads.vn/cmkt/1/2/master.mp4' },
        ai_assets: [{ id: 'video-9', type: 'video', url: 'https://cdn.pttads.vn/cmkt/1/2/master.mp4' }],
      },
      production_json: {},
    });

    await expect(svc.approveVisual(1, 2, {}, 'a@b.c')).rejects.toThrow(/video_qa/);
    expect(mediaClean.promoteMediaJson).not.toHaveBeenCalled();
    expect(repo.patchItem).not.toHaveBeenCalled();
  });
});
