import { isInsightStale, utcDateKey } from './insight-stale.util';

describe('insight-stale.util', () => {
  const ref = new Date('2026-08-15T12:00:00.000Z');

  it('utcDateKey uses UTC calendar date', () => {
    expect(utcDateKey(ref)).toBe('2026-08-15');
  });

  it('isInsightStale is false when valid_to is null or empty', () => {
    expect(isInsightStale(null, ref)).toBe(false);
    expect(isInsightStale('', ref)).toBe(false);
    expect(isInsightStale('  ', ref)).toBe(false);
  });

  it('isInsightStale is false when valid_to is today or later', () => {
    expect(isInsightStale('2026-08-15', ref)).toBe(false);
    expect(isInsightStale('2026-09-01', ref)).toBe(false);
  });

  it('isInsightStale is true when valid_to is before today', () => {
    expect(isInsightStale('2026-08-14', ref)).toBe(true);
    expect(isInsightStale('2025-12-31', ref)).toBe(true);
  });
});
