import { ContentVisualQaService } from './content-visual-qa.service';
import type { CmktMediaAsset } from './content-marketing.types';

describe('ContentVisualQaService', () => {
  const svc = new ContentVisualQaService();

  it('scores CDN assets higher than picsum placeholders', () => {
    const cdn: CmktMediaAsset[] = [
      {
        id: 'a1',
        type: 'image',
        url: 'https://cdn.pttads.vn/cmkt/1/2/a1.webp',
        ai_generated: true,
        provider: 'stub',
      },
    ];
    const picsum: CmktMediaAsset[] = [
      {
        id: 'a2',
        type: 'image',
        url: 'https://picsum.photos/seed/x/1080/1080',
        ai_generated: true,
        provider: 'legacy',
      },
    ];
    const cdnResult = svc.scoreAssets(cdn, { aspectRatio: '1:1' });
    const picsumResult = svc.scoreAssets(picsum, { aspectRatio: '1:1' });
    expect(cdnResult.checks.dimensions_ok).toBe(true);
    expect(picsumResult.checks.dimensions_ok).toBe(false);
    expect(cdnResult.score).toBeGreaterThanOrEqual(picsumResult.score);
  });

  it('returns extensible check keys', () => {
    const result = svc.scoreAssets(
      [{ id: 'x', type: 'image', url: 'https://cdn.pttads.vn/cmkt/x.webp', ai_generated: true, provider: 'stub' }],
      { aspectRatio: '9:16' },
    );
    expect(result.checks).toMatchObject({
      assets_present: true,
      channel_spec: true,
      ocr_confidence_ok: expect.any(Boolean),
    });
  });
});
