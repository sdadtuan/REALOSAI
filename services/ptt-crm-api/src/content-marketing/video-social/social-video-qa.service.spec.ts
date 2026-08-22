import { scoreMaster } from './social-video-qa.service';

describe('social-video-qa.service', () => {
  it('blocks when no video stream', () => {
    const qa = scoreMaster({
      probe: { hasVideo: false, hasAudio: true, width: 1080, height: 1920, durationSec: 20, fps: 30 },
      packId: 'reels',
      hasCaptions: true,
      hasHookLayer: true,
      hasLogoOrSkipped: true,
      draftWatermark: true,
      visualApproved: false,
      licenseCount: 2,
    });
    expect(qa.blocked).toBe(true);
    expect(qa.checks.file_ok).toBe(false);
  });

  it('blocks approve-ready file without licenses', () => {
    const qa = scoreMaster({
      probe: { hasVideo: true, hasAudio: true, width: 1080, height: 1920, durationSec: 20, fps: 30 },
      packId: 'reels',
      hasCaptions: true,
      hasHookLayer: true,
      hasLogoOrSkipped: true,
      draftWatermark: true,
      visualApproved: false,
      licenseCount: 0,
    });
    expect(qa.checks.license_ok).toBe(false);
    expect(qa.blocked).toBe(true);
  });
});
