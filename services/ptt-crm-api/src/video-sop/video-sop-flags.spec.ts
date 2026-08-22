import { assertCinematicEnabled, parseCinematicDailyCap } from './video-sop-flags';

describe('video-sop-flags', () => {
  it('throws cmkt_cinematic_disabled when flag off', () => {
    expect(() =>
      assertCinematicEnabled({ contentMarketingVideoCinematicEnabled: false }),
    ).toThrow(/cmkt_cinematic_disabled/);
  });

  it('passes when flag on', () => {
    expect(() =>
      assertCinematicEnabled({ contentMarketingVideoCinematicEnabled: true }),
    ).not.toThrow();
  });

  describe('parseCinematicDailyCap', () => {
    it('floors fractional positive values to at least 1', () => {
      expect(parseCinematicDailyCap('0.5')).toBe(1);
    });

    it('floors positive values', () => {
      expect(parseCinematicDailyCap('2.9')).toBe(2);
    });

    it('defaults unset to 1', () => {
      expect(parseCinematicDailyCap(undefined)).toBe(1);
    });

    it('defaults zero to 1', () => {
      expect(parseCinematicDailyCap('0')).toBe(1);
    });

    it('defaults negative values to 1', () => {
      expect(parseCinematicDailyCap('-3')).toBe(1);
    });
  });
});
