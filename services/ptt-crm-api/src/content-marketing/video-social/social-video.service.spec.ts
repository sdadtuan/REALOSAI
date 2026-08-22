import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SocialVideoService } from './social-video.service';

jest.mock('../video-kernel/video-ffprobe.util', () => ({
  assertFfmpegAvailable: jest.fn(),
  probeFile: jest.fn(() => ({
    hasVideo: true,
    hasAudio: true,
    width: 1080,
    height: 1920,
    durationSec: 20,
    fps: 30,
  })),
  ffprobeBinFromFfmpeg: jest.fn(() => 'ffprobe'),
}));

describe('SocialVideoService', () => {
  const config = {
    contentMarketingVideoSocialEnabled: true,
    contentMarketingVideoGenEnabled: true,
    contentMarketingMediaEnabled: true,
    contentMarketingImageGenEnabled: true,
    contentMarketingVideoSocialDailyCap: 3,
    contentMarketingVideoOneShot: true,
    contentMarketingMediaAsync: false,
    contentMarketingVideoProvider: 'ffmpeg',
    contentMarketingFfmpegBin: 'ffmpeg',
  };
  const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue(undefined) };
  const repo = {
    getItemById: jest.fn(),
    countSocialJobsToday: jest.fn().mockResolvedValue(0),
    createContentJob: jest.fn(),
    patchItem: jest.fn(),
  };
  const worker = { processJob: jest.fn() };
  const tts = { synthesize: jest.fn(), providerName: 'stub' };
  const stock = { fetchClips: jest.fn(), providerName: 'stub' };
  const storage = { uploadAsset: jest.fn(), cdnBase: 'https://cdn.pttads.vn/cmkt' };
  const composer = { composeSocialMaster: jest.fn() };
  const licenses = { insertLicense: jest.fn(), listByItem: jest.fn().mockResolvedValue([]) };

  let svc: SocialVideoService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.countSocialJobsToday.mockResolvedValue(0);
    core.ensureLifecycleEnabled.mockResolvedValue(undefined);
    config.contentMarketingVideoSocialDailyCap = 3;
    svc = new SocialVideoService(
      config as never,
      core as never,
      repo as never,
      worker as never,
      tts as never,
      stock as never,
      storage as never,
      composer as never,
      licenses as never,
    );
  });

  it('rejects cinematic item for social render', async () => {
    repo.getItemById.mockResolvedValue({
      format: 'video_script',
      channel: 'short_video',
      status: 'approved_internal',
      media_json: { video_studio: 'cinematic' },
    });
    await expect(svc.startRender(1, 2, {}, 'a@b.c')).rejects.toThrow(/studio_mismatch/);
  });

  it('counts only social jobs toward social cap', async () => {
    repo.countSocialJobsToday.mockResolvedValue(3);
    config.contentMarketingVideoSocialDailyCap = 3;
    await expect(svc.startStoryboard(1, 2, { pack_default: 'reels' }, 'a@b.c')).rejects.toThrow(/video_daily_cap/);
  });

  it('rejects too-long script before createContentJob', async () => {
    const long = Array.from({ length: 200 }, () => 'từ').join(' ');
    repo.getItemById.mockResolvedValue({
      format: 'video_script',
      channel: 'short_video',
      status: 'approved_internal',
      title: 'Hook',
      body_json: { markdown: long },
      media_json: { video_studio: 'social' },
    });
    await expect(svc.startStoryboard(1, 2, { pack_default: 'reels' }, 'a@b.c')).rejects.toThrow(
      /script_too_long/,
    );
    expect(repo.createContentJob).not.toHaveBeenCalled();
  });

  it('persists uploaded CDN url without manifest rewrite', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cmkt-social-'));
    const masterPath = join(tmp, 'master.mp4');
    const posterPath = join(tmp, 'poster.webp');
    const voicePath = join(tmp, 'voice.mp3');
    writeFileSync(masterPath, 'mp4');
    writeFileSync(posterPath, 'webp');
    writeFileSync(voicePath, 'mp3');

    composer.composeSocialMaster.mockResolvedValue({ masterPath, posterPath });
    storage.uploadAsset.mockImplementation(
      async (input: { assetId: string; fileExt?: string; contentType: string }) => {
        const ext =
          input.fileExt ?? (input.contentType.includes('mp4') ? 'mp4' : 'webp');
        return {
          url: `https://cdn.pttads.vn/cmkt/1/2/${input.assetId}.${ext}`,
          storageKey: `1/2/${input.assetId}.${ext}`,
        };
      },
    );
    licenses.listByItem.mockResolvedValue([{ id: 1 }]);
    repo.createContentJob.mockResolvedValue({ id: 12, job_type: 'social_transcode' });
    worker.processJob.mockResolvedValue({ status: 'succeeded' });

    await svc.executeRender(
      { id: 9, lifecycle_id: 1, item_id: 2, job_type: 'social_render', input_json: {}, created_by: 'a@b.c' } as never,
      {
        id: 2,
        channel: 'short_video',
        title: 'Hook',
        body_json: { markdown: 'hook pain proof cta' },
        visual_status: 'ai_pending',
        production_json: {},
        media_json: {
          video_studio: 'social',
          storyboard: {
            version: 1,
            pack_default: 'reels',
            requested_packs: ['reels'],
            style_preset: 'corporate',
            voice: { provider: 'stub', voice_id: 'stub', lang: 'vi' },
            beats: [
              {
                id: 'hook',
                start_ms: 0,
                end_ms: 3000,
                script_excerpt: 'hook',
                keywords: [],
                clip_id: null,
                on_screen_text: 'hook',
                locked: false,
              },
            ],
            tts: { storage_key: 'tts', duration_sec: 20, url: voicePath },
          },
        },
      } as never,
    );

    expect(repo.patchItem).toHaveBeenCalled();
    const payload = JSON.stringify(repo.patchItem.mock.calls);
    expect(payload).not.toContain("replace('-manifest.json', '.mp4')");
    const media = repo.patchItem.mock.calls[0][2].media_json as { video_short: { url: string } };
    expect(media.video_short.url).toBe('https://cdn.pttads.vn/cmkt/1/2/master-9.mp4');
    expect(media.video_short.url).not.toMatch(/-manifest\.json/);
    expect(repo.createContentJob).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: 'social_transcode',
        input_json: { packs: ['reels'] },
      }),
    );
  });

  it('enqueues shorts transcode for youtube channel after render', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cmkt-social-'));
    const masterPath = join(tmp, 'master.mp4');
    const posterPath = join(tmp, 'poster.webp');
    const voicePath = join(tmp, 'voice.mp3');
    writeFileSync(masterPath, 'mp4');
    writeFileSync(posterPath, 'webp');
    writeFileSync(voicePath, 'mp3');

    composer.composeSocialMaster.mockResolvedValue({ masterPath, posterPath });
    storage.uploadAsset.mockImplementation(
      async (input: { assetId: string; fileExt?: string; contentType: string }) => {
        const ext =
          input.fileExt ?? (input.contentType.includes('mp4') ? 'mp4' : 'webp');
        return {
          url: `https://cdn.pttads.vn/cmkt/1/2/${input.assetId}.${ext}`,
          storageKey: `1/2/${input.assetId}.${ext}`,
        };
      },
    );
    repo.createContentJob.mockResolvedValue({ id: 12, job_type: 'social_transcode' });
    worker.processJob.mockResolvedValue({ status: 'succeeded' });

    await svc.executeRender(
      { id: 10, lifecycle_id: 1, item_id: 2, job_type: 'social_render', input_json: {}, created_by: 'a@b.c' } as never,
      {
        id: 2,
        channel: 'youtube',
        title: 'Hook',
        body_json: { markdown: 'hook pain proof cta' },
        visual_status: 'ai_pending',
        production_json: {},
        media_json: {
          video_studio: 'social',
          storyboard: {
            version: 1,
            pack_default: 'reels',
            requested_packs: ['reels'],
            style_preset: 'corporate',
            voice: { provider: 'stub', voice_id: 'stub', lang: 'vi' },
            beats: [{ id: 'hook', start_ms: 0, end_ms: 3000, script_excerpt: 'hook', keywords: [], clip_id: null, locked: false }],
            tts: { storage_key: 'tts', duration_sec: 20, url: voicePath },
          },
        },
      } as never,
    );

    expect(repo.createContentJob).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: 'social_transcode',
        input_json: { packs: ['shorts'] },
      }),
    );
  });

  it('skips auto transcode for facebook feed after render', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'cmkt-social-'));
    const masterPath = join(tmp, 'master.mp4');
    const posterPath = join(tmp, 'poster.webp');
    const voicePath = join(tmp, 'voice.mp3');
    writeFileSync(masterPath, 'mp4');
    writeFileSync(posterPath, 'webp');
    writeFileSync(voicePath, 'mp3');

    composer.composeSocialMaster.mockResolvedValue({ masterPath, posterPath });
    storage.uploadAsset.mockImplementation(
      async (input: { assetId: string; fileExt?: string; contentType: string }) => {
        const ext =
          input.fileExt ?? (input.contentType.includes('mp4') ? 'mp4' : 'webp');
        return {
          url: `https://cdn.pttads.vn/cmkt/1/2/${input.assetId}.${ext}`,
          storageKey: `1/2/${input.assetId}.${ext}`,
        };
      },
    );

    await svc.executeRender(
      { id: 11, lifecycle_id: 1, item_id: 2, job_type: 'social_render', input_json: {}, created_by: 'a@b.c' } as never,
      {
        id: 2,
        channel: 'facebook',
        title: 'Hook',
        body_json: { markdown: 'hook pain proof cta' },
        visual_status: 'ai_pending',
        production_json: {},
        media_json: {
          video_studio: 'social',
          storyboard: {
            version: 1,
            pack_default: 'reels',
            requested_packs: ['reels'],
            style_preset: 'corporate',
            voice: { provider: 'stub', voice_id: 'stub', lang: 'vi' },
            beats: [{ id: 'hook', start_ms: 0, end_ms: 3000, script_excerpt: 'hook', keywords: [], clip_id: null, locked: false }],
            tts: { storage_key: 'tts', duration_sec: 20, url: voicePath },
          },
        },
      } as never,
    );

    expect(repo.createContentJob).not.toHaveBeenCalledWith(
      expect.objectContaining({ job_type: 'social_transcode' }),
    );
  });

  it('does not enqueue social_render after failed storyboard', async () => {
    repo.getItemById.mockResolvedValue({
      format: 'video_script',
      channel: 'short_video',
      status: 'approved_internal',
      media_json: { video_studio: 'social' },
    });
    repo.createContentJob.mockResolvedValue({ id: 11, job_type: 'social_storyboard' });
    worker.processJob.mockResolvedValue({ status: 'failed' });

    try {
      await svc.startOneShot(1, 2, { pack_default: 'reels' }, 'a@b.c');
    } catch {
      /* throw is acceptable; must not enqueue render */
    }

    expect(repo.createContentJob).not.toHaveBeenCalledWith(
      expect.objectContaining({ job_type: 'social_render' }),
    );
  });
});
