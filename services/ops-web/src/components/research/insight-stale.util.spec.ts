import { describe, expect, it } from 'vitest';
import { INSIGHT_STALE_BANNER, insightIsStale, isInsightStale, ragHitIsStale } from './insight-stale.util';

describe('insight-stale.util', () => {
  const ref = new Date('2026-08-15T12:00:00.000Z');

  it('keeps stale banner verbatim', () => {
    expect(INSIGHT_STALE_BANNER).toContain('valid_to');
  });

  it('insightIsStale prefers API is_stale flag', () => {
    expect(insightIsStale({ is_stale: true, valid_to: '2099-01-01' }, ref)).toBe(true);
    expect(insightIsStale({ is_stale: false, valid_to: '2020-01-01' }, ref)).toBe(false);
  });

  it('insightIsStale falls back to valid_to when is_stale missing', () => {
    expect(insightIsStale({ valid_to: '2026-08-14' }, ref)).toBe(true);
    expect(isInsightStale('2026-08-15', ref)).toBe(false);
  });

  it('P22 ragHitIsStale prefers API is_stale flag', () => {
    const ref = new Date('2026-08-15T00:00:00.000Z');
    expect(ragHitIsStale({ is_stale: true, valid_to: '2099-01-01' }, ref)).toBe(true);
    expect(ragHitIsStale({ is_stale: false, valid_to: '2020-01-01' }, ref)).toBe(false);
    expect(ragHitIsStale({ valid_to: '2020-01-01' }, ref)).toBe(true);
    expect(ragHitIsStale({ valid_to: null }, ref)).toBe(false);
  });
});
