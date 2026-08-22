import {
  DEFAULT_HOLD_TTL_SECONDS,
  canCloseLaunch,
  canOpenLaunch,
  computeLaunchExpiresAt,
} from './bds-launch.util';

describe('bds-launch.util', () => {
  it('BDS-36: default TTL is 180s', () => {
    expect(DEFAULT_HOLD_TTL_SECONDS).toBe(180);
  });

  it('expires_at = now + ttl seconds', () => {
    const now = new Date('2026-08-22T10:00:00Z');
    expect(computeLaunchExpiresAt(now, 180).toISOString()).toBe('2026-08-22T10:03:00.000Z');
  });

  it('open only from draft', () => {
    expect(canOpenLaunch('draft')).toBe(true);
    expect(canOpenLaunch('open')).toBe(false);
    expect(canOpenLaunch('closed')).toBe(false);
  });

  it('close only from open', () => {
    expect(canCloseLaunch('open')).toBe(true);
    expect(canCloseLaunch('draft')).toBe(false);
    expect(canCloseLaunch('closed')).toBe(false);
  });
});
