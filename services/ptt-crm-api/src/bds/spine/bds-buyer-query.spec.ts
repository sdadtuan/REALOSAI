import { maskBdsPhone, pickLatestHold, pickLatestTx } from './bds-buyer-query';
import type { HoldRow } from '../hold/bds-hold.repository';
import type { TxRow } from '../transactions/bds-tx.types';

describe('bds-buyer-query', () => {
  it('masks phone without view_pii', () => {
    expect(maskBdsPhone('+84912345678', false)).toBe('+849****5678');
    expect(maskBdsPhone('+84912345678', true)).toBe('+84912345678');
  });

  it('prefers active hold over expired', () => {
    const hold = pickLatestHold([
      {
        id: 'h1',
        status: 'expired',
        expires_at: new Date('2026-01-01'),
        product_id: 1,
        updated_at: new Date('2026-01-02'),
      } as HoldRow,
      {
        id: 'h2',
        status: 'active',
        expires_at: new Date('2026-08-24'),
        product_id: 2,
        updated_at: new Date('2026-01-01'),
      } as HoldRow,
    ]);
    expect(hold?.id).toBe('h2');
  });

  it('prefers open tx over cancelled', () => {
    const tx = pickLatestTx([
      {
        id: 't1',
        stage: 'cancelled',
        updated_at: new Date('2026-08-01'),
      } as TxRow,
      {
        id: 't2',
        stage: 'deposit',
        updated_at: new Date('2026-07-01'),
      } as TxRow,
    ]);
    expect(tx?.id).toBe('t2');
  });
});
