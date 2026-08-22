import { computeCommissionAmounts } from './b2b-commission-ledger.util';

describe('b2b-commission-ledger.util', () => {
  it('split 30/70 on 10_000_000 → 3tr / 7tr', () => {
    expect(
      computeCommissionAmounts({
        amountVnd: 10_000_000,
        firstTouchPct: 30,
        closerPct: 70,
      }),
    ).toEqual({ first_touch_amt: 3_000_000, closer_amt: 7_000_000 });
  });
});
