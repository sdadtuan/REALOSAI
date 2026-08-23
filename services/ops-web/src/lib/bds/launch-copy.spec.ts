import { describe, expect, it } from 'vitest';
import {
  buildLaunchOpenChecklist,
  canOpenFromChecklist,
  formatLaunchTtlSec,
  launchTtlBarPercent,
  launchTtlUrgency,
  ttlRemainingFromExpires,
} from './launch-copy';

describe('launch-copy', () => {
  it('formats short TTL as seconds', () => {
    expect(formatLaunchTtlSec(142)).toBe('142s');
    expect(formatLaunchTtlSec(0)).toBe('Hết hạn');
  });

  it('TTL bar and urgency', () => {
    expect(launchTtlBarPercent(90, 180)).toBe(50);
    expect(launchTtlUrgency(20, 180)).toBe('critical');
    expect(launchTtlUrgency(40, 180)).toBe('warn');
  });

  it('checklist blocks open without G0', () => {
    const items = buildLaunchOpenChecklist({
      g0Ready: false,
      missingG0: ['pm_du_an'],
      priceListId: 3,
      phaseId: null,
      holdTtlSeconds: 180,
    });
    expect(canOpenFromChecklist(items)).toBe(false);
    expect(items.find((i) => i.id === 'g0')?.ok).toBe(false);
  });

  it('expires_at drives client TTL', () => {
    const now = new Date('2026-08-23T10:00:00Z');
    const exp = new Date('2026-08-23T10:02:30Z').toISOString();
    expect(ttlRemainingFromExpires(exp, now)).toBe(150);
  });
});
