import { describe, expect, it } from 'vitest';
import { reportRowIsStale, utcDateKey } from './insight-stale.util';

describe('reportRowIsStale', () => {
  it('is_stale true wins over a future valid_to', () => {
    expect(reportRowIsStale({ is_stale: true, valid_to: '2099-01-01' })).toBe(true);
  });

  it('past valid_to without flag is stale', () => {
    expect(reportRowIsStale({ valid_to: '2020-01-01' })).toBe(true);
  });

  it('today or null valid_to without flag is not stale', () => {
    expect(reportRowIsStale({ valid_to: utcDateKey() })).toBe(false);
    expect(reportRowIsStale({ valid_to: null })).toBe(false);
  });
});
