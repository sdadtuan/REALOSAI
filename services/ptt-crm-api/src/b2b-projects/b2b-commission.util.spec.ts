import { splitOnSlaHop } from './b2b-commission.util';

describe('splitOnSlaHop', () => {
  it('B2B-15 30/70', () => {
    expect(splitOnSlaHop({ firstTouchPct: 30, closerPct: 70 })).toEqual({
      first_touch_pct: 30,
      closer_pct: 70,
    });
  });
});
