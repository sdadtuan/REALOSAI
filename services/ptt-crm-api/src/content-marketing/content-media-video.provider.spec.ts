import { ContentMediaVideoProvider } from './content-media-video.provider';
import { ContentMediaTtsProvider } from './content-media-tts.provider';
import { ContentMediaStockProvider } from './content-media-stock.provider';

describe('ContentMediaVideoProvider', () => {
  const config = {
    contentMarketingVideoProvider: 'pipeline',
    contentMarketingCdnBase: 'https://cdn.pttads.vn/cmkt',
  };
  const tts = {
    synthesize: jest.fn().mockResolvedValue({
      audioBuffer: Buffer.from('mp3'),
      provider: 'stub',
      durationSec: 30,
      voice: 'stub',
    }),
  };
  const stock = {
    providerName: 'stub',
    fetchClips: jest.fn().mockResolvedValue([
      {
        id: 'clip-1',
        url: 'https://cdn.pttads.vn/cmkt/stock/a.mp4',
        poster_url: 'https://cdn.pttads.vn/cmkt/stock/a.webp',
        duration_sec: 8,
        provider: 'stub',
        keyword: 'marketing',
      },
    ]),
  };
  const storage = {
    cdnBase: 'https://cdn.pttads.vn/cmkt',
    uploadAsset: jest.fn().mockResolvedValue({
      url: 'https://cdn.pttads.vn/cmkt/1/5/manifest.json',
      storageKey: '1/5/manifest.json',
    }),
  };

  let provider: ContentMediaVideoProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new ContentMediaVideoProvider(
      config as never,
      tts as never,
      stock as never,
      storage as never,
    );
  });

  it('throws on non-stub provider instead of inventing a CDN mp4', async () => {
    await expect(
      provider.generateShortVideo({
        lifecycleId: 1,
        itemId: 5,
        script: 'Hook nhanh về content marketing educational',
        title: 'Reels test',
      }),
    ).rejects.toThrow(/use_social_pipeline|ffmpeg_missing/);
    expect(storage.uploadAsset).not.toHaveBeenCalled();
  });
});

describe('ContentMediaTtsProvider', () => {
  it('returns stub audio when no API key', async () => {
    const svc = new ContentMediaTtsProvider(
      { contentMarketingTtsProvider: 'openai', contentMarketingTtsVoice: 'alloy' } as never,
      { llmApiKey: null } as never,
    );
    const out = await svc.synthesize('Hello world script for short video');
    expect(out.provider).toBe('stub');
    expect(out.durationSec).toBeGreaterThan(0);
  });
});

describe('ContentMediaStockProvider', () => {
  it('returns stub clips without API key', async () => {
    const svc = new ContentMediaStockProvider({
      contentMarketingStockProvider: 'pexels',
      contentMarketingStockApiKey: '',
      contentMarketingCdnBase: 'https://cdn.pttads.vn/cmkt',
    } as never);
    const clips = await svc.fetchClips('marketing content strategy hook');
    expect(clips.length).toBeGreaterThan(0);
    expect(clips[0]?.provider).toBe('stub');
  });
});
