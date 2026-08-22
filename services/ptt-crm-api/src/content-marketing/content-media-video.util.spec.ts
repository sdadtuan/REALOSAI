import { buildVideoShortStub, itemEligibleForVideoShort } from './content-media-video.util';

describe('content-media-video.util', () => {
  it('itemEligibleForVideoShort accepts video_script', () => {
    expect(itemEligibleForVideoShort({ channel: 'facebook', format: 'video_script' })).toBe(true);
  });

  it('buildVideoShortStub returns mp4 asset', () => {
    const out = buildVideoShortStub({
      lifecycleId: 1,
      itemId: 9,
      script: 'Hook 3s · beat · CTA',
      cdnBase: 'https://cdn.test/cmkt',
    });
    expect(out.asset.type).toBe('video');
    expect(out.asset.url).toContain('.mp4');
    expect(out.progress.progress_pct).toBe(100);
    expect(out.progress.steps.stitch).toBe('done');
  });
});
