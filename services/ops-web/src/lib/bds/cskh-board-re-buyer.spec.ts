import { describe, expect, it } from 'vitest';
import { isHoldTtlOverdue, showReBuyerBoardColumns } from './cskh-board-re-buyer';

describe('showReBuyerBoardColumns', () => {
  it('true only for flow=re_buyer', () => {
    expect(showReBuyerBoardColumns('re_buyer')).toBe(true);
    expect(showReBuyerBoardColumns(undefined)).toBe(false);
  });
});

describe('isHoldTtlOverdue', () => {
  it('flags past expiry', () => {
    expect(isHoldTtlOverdue('2020-01-01T00:00:00.000Z', Date.parse('2026-01-01'))).toBe(true);
    expect(isHoldTtlOverdue('2030-01-01T00:00:00.000Z', Date.parse('2026-01-01'))).toBe(false);
  });
});
