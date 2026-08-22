import { evaluateGate4Auto } from './vd-qc-auto';

describe('evaluateGate4Auto', () => {
  it('blocks when audio missing', () => {
    const result = evaluateGate4Auto({
      hasVideo: true,
      hasAudio: false,
      durationSec: 20,
      lufs: -14,
    });
    expect(result.blocked).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain('missing_audio');
  });

  it('passes valid probe', () => {
    const result = evaluateGate4Auto({
      hasVideo: true,
      hasAudio: true,
      durationSec: 20,
      lufs: -14,
    });
    expect(result.blocked).toBe(false);
    expect(result.ok).toBe(true);
  });
});
