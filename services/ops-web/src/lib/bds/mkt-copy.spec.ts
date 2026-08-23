import { describe, expect, it } from 'vitest';
import { isMetaAdAccountMapped, mktLeadFormHint, normalizeMetaAdAccountId } from './mkt-copy';

describe('mkt-copy', () => {
  it('normalizes act id', () => {
    expect(normalizeMetaAdAccountId('123')).toBe('act_123');
  });

  it('hint when unmapped', () => {
    expect(mktLeadFormHint(false)).toMatch(/MK-02/);
    expect(mktLeadFormHint(true)).toMatch(/bật form/i);
  });

  it('mapped check', () => {
    expect(isMetaAdAccountMapped('act_x')).toBe(true);
    expect(isMetaAdAccountMapped('')).toBe(false);
  });
});
