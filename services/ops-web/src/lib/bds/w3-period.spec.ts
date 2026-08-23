import { describe, expect, it } from 'vitest';
import { toPeriodMonthStart } from './w3-period';

describe('toPeriodMonthStart', () => {
  it('normalizes YYYY-MM to YYYY-MM-01', () => {
    expect(toPeriodMonthStart('2026-08')).toBe('2026-08-01');
    expect(toPeriodMonthStart('2026-08-01')).toBe('2026-08-01');
  });
});
