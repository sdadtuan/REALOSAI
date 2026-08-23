import { describe, expect, it } from 'vitest';
import {
  filterHoldableUnits,
  formatHoldTtlRemaining,
  holdCreateSuccessMessage,
  isUnitHoldable,
} from './pwa-hold-copy';

describe('pwa-hold-copy', () => {
  it('only available units are holdable', () => {
    expect(isUnitHoldable('available')).toBe(true);
    expect(isUnitHoldable('hold')).toBe(false);
    expect(filterHoldableUnits([
      { id: 1, unit_code: 'A1', status: 'available' },
      { id: 2, unit_code: 'A2', status: 'hold' },
    ])).toHaveLength(1);
  });

  it('formats TTL countdown', () => {
    const now = new Date('2026-08-23T10:00:00Z');
    const expires = new Date('2026-08-23T10:14:30Z').toISOString();
    expect(formatHoldTtlRemaining(expires, now)).toBe('14:30');
  });

  it('success toast mentions unit and ttl', () => {
    const msg = holdCreateSuccessMessage('A-1204', new Date('2026-08-23T10:05:00Z').toISOString());
    expect(msg).toMatch(/A-1204/);
    expect(msg).toMatch(/hết hạn/i);
  });
});
