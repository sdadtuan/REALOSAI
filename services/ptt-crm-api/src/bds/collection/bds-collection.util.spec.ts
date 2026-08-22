import { BadRequestException } from '@nestjs/common';
import {
  agingBucket,
  assertReceiptWithinBalance,
  computePaidPct,
  parsePaymentTemplate,
} from './bds-collection.util';

describe('bds-collection.util', () => {
  it('computePaidPct rounds 2 decimals', () => {
    expect(computePaidPct(30_000_000, 100_000_000)).toBe(30);
  });

  it('receipt over balance throws receipt_over', () => {
    try {
      assertReceiptWithinBalance(50, 100, 60);
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'receipt_over' });
    }
    expect(() => assertReceiptWithinBalance(40, 100, 60)).not.toThrow();
  });

  it('aging buckets', () => {
    expect(agingBucket(10)).toBe('0_15');
    expect(agingBucket(45)).toBe('31_60');
  });

  it('parsePaymentTemplate validates pct sum', () => {
    expect(parsePaymentTemplate([{ code: 'a', pct: 30, due_days_from_deposit: 0 }])).toHaveLength(1);
    expect(() => parsePaymentTemplate([{ code: 'a', pct: 60 }, { code: 'b', pct: 50 }])).toThrow(
      BadRequestException,
    );
  });
});
