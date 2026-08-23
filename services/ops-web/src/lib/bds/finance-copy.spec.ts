import { describe, expect, it } from 'vitest';
import { adsRoasCopy, financeHubDisclaimer } from './finance-copy';

describe('finance-copy', () => {
  it('U-09 disclaimer', () => {
    expect(financeHubDisclaimer()).toContain('không phải hạch toán');
  });

  it('ROAS does not invent spend', () => {
    expect(adsRoasCopy(false)).toBe('Chưa gắn ad account');
  });
});
