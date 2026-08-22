import { evaluateFeasibility } from './vd-feasibility.rules';

describe('evaluateFeasibility', () => {
  it('FR-R01 fails when duration_ms is 16000', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 16000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R01')?.ok).toBe(false);
  });
  it('FR-R02 fails when text_in_frame is true', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: true, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R02')?.ok).toBe(false);
  });
  it('FR-R03 fails when contains_human is not boolean', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: 'yes', aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R03')?.ok).toBe(false);
  });
  it('FR-R04 fails when aspect is 16:9', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '16:9',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R04')?.ok).toBe(false);
  });
  it('FR-R05 fails when shot count is 1', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R05')?.ok).toBe(false);
  });
  it('FR-R06 fails when camera is empty', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: '', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R06')?.ok).toBe(false);
  });
  it('FR-R07 fails when logo_in_ai_frame is true', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: true, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R07')?.ok).toBe(false);
  });
  it('FR-R08 fails when keyframe_approved and seed null', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: null, status: 'keyframe_approved',
    }]);
    expect(rows.find((r) => r.id === 'FR-R08')?.ok).toBe(false);
  });
  it('FR-R09 fails when duration_sec is 10', () => {
    const rows = evaluateFeasibility({ duration_sec: 10, platform: 'reels' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R09')?.ok).toBe(false);
  });
  it('FR-R10 fails when platform is tiktok', () => {
    const rows = evaluateFeasibility({ duration_sec: 30, platform: 'tiktok' }, [{
      duration_ms: 3000, text_in_frame: false, contains_human: false, aspect: '9:16',
      camera: 'push in', action: 'walk', logo_in_ai_frame: false, seed: 1, status: 'draft',
    }]);
    expect(rows.find((r) => r.id === 'FR-R10')?.ok).toBe(false);
  });
});
