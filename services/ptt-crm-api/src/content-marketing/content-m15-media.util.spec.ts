import {
  deltaE76,
  extractBrandPalette,
  hexToRgb,
  minDeltaEToPalette,
  rgbToLab,
  scoreFromImageAnalysis,
} from './content-visual-qa.util';
import { extractClipKeywords } from './content-media-stock.provider';
import { ContentMediaCleanService } from './content-media-clean.service';
import { ContentMediaGenerateService } from './content-media-generate.service';
import type { CmktMediaAsset } from './content-marketing.types';

describe('content-visual-qa.util', () => {
  it('computes deltaE between similar colors', () => {
    const a = rgbToLab(30, 58, 95);
    const b = rgbToLab(32, 60, 98);
    expect(deltaE76(a, b)).toBeLessThan(5);
  });

  it('extracts palette from brand context', () => {
    const palette = extractBrandPalette({
      palette_colors: ['#1e3a5f', '#ffffff'],
      _source: 'snapshot',
    });
    expect(palette.colors).toEqual(['#1e3a5f', '#ffffff']);
  });

  it('scores image analysis with OCR and brand checks', () => {
    const scored = scoreFromImageAnalysis(
      {
        brand_delta_e_max: 8,
        brand_delta_e_avg: 8,
        ocr_confidence: 0.82,
        contrast_ratio: 5.2,
        dominant_hex: '#1e3a5f',
      },
      {
        assets_present: true,
        dimensions_ok: true,
        channel_spec: true,
        policy_ok: true,
        safe_zone: true,
        no_draft_on_approved: false,
        brand_colors: true,
        text_readable: true,
      },
    );
    expect(scored.checks.brand_delta_e_ok).toBe(true);
    expect(scored.checks.ocr_confidence_ok).toBe(true);
    expect(scored.score).toBeGreaterThanOrEqual(70);
  });

  it('maps dominant rgb to palette distance', () => {
    const rgb = hexToRgb('#1e3a5f');
    expect(rgb).not.toBeNull();
    const delta = minDeltaEToPalette(rgb!, ['#1e3a5f', '#ffffff']);
    expect(delta).toBeLessThan(1);
  });
});

describe('content-media-stock.provider keywords', () => {
  it('extracts clip keywords from script', () => {
    const keywords = extractClipKeywords('Double-down educational content marketing carousel hook');
    expect(keywords.length).toBeGreaterThan(0);
  });
});

describe('ContentMediaCleanService', () => {
  const storage = {
    buildPublicUrl: (key: string) => `https://cdn.pttads.vn/cmkt/${key}`,
  };
  const cache = {
    deleteCleanBuffer: jest.fn(),
  };
  const socialVideo = {
    composeCleanMaster: jest.fn().mockResolvedValue(null),
  };
  const svc = new ContentMediaCleanService(storage as never, cache as never, socialVideo as never);

  it('promotes clean asset url on approve', () => {
    const asset: CmktMediaAsset = {
      id: 'a1',
      type: 'image',
      url: 'https://cdn.pttads.vn/cmkt/1/2/a1.webp',
      ai_generated: true,
      provider: 'stub',
      draft_watermark: true,
      storage_key: '1/2/a1.webp',
      clean_storage_key: '1/2/a1-clean.webp',
    };
    const promoted = svc.promoteAsset(asset, 1, 2);
    expect(promoted.url).toContain('a1-clean.webp');
    expect(promoted.draft_watermark).toBe(false);
    expect(cache.deleteCleanBuffer).toHaveBeenCalledWith(1, 2, 'a1');
  });

  it('sets draft_watermark false on social video after clean', () => {
    const videoAsset: CmktMediaAsset = {
      id: 'video-9',
      type: 'video',
      url: 'https://cdn.pttads.vn/cmkt/1/2/master-9.mp4',
      ai_generated: true,
      provider: 'ffmpeg',
      selected: true,
      draft_watermark: true,
      storage_key: '1/2/master-9.mp4',
    };
    const promoted = svc.promoteAsset(videoAsset, 1, 2);
    expect(promoted.draft_watermark).toBe(false);
    expect(promoted.type).toBe('video');
  });
});

describe('selectMediaAsset pack tiles', () => {
  it('selects a video_packs thumbnail without asset_not_found', async () => {
    const core = { ensureLifecycleEnabled: jest.fn().mockResolvedValue(undefined) };
    const repo = {
      getItemById: jest.fn().mockResolvedValue({
        id: 2,
        media_json: {
          video_short: {
            id: 'video-9',
            type: 'video',
            url: 'https://cdn.pttads.vn/cmkt/1/2/master.mp4',
          },
          video_packs: {
            reels: {
              id: 'pack-reels',
              type: 'video',
              url: 'https://cdn.pttads.vn/cmkt/1/2/reels.mp4',
            },
          },
        },
      }),
      patchItem: jest.fn(async (_lc: number, _id: number, patch: { media_json: unknown }) => ({
        id: 2,
        body_json: {},
        media_json: patch.media_json,
      })),
      insertItemVersion: jest.fn(),
    };
    const svc = new ContentMediaGenerateService(
      {} as never,
      core as never,
      repo as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const updated = await svc.selectMediaAsset(1, 2, { asset_id: 'pack-reels' }, 'a@b.c');
    expect(updated.media_json?.selected_asset_id).toBe('pack-reels');
    expect(repo.insertItemVersion).toHaveBeenCalled();
  });
});
