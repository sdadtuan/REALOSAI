import { decideFirstAssign } from './b2b-assign.util';

describe('decideFirstAssign', () => {
  const pool = [
    { staffId: 1, salesLevel: 's', openFirstTouch: 2, inCall: false },
    { staffId: 2, salesLevel: 'a', openFirstTouch: 0, inCall: false },
  ];

  it('B2B-08 ai_analytics when confidence >= 0.75 and pick in pool', () => {
    const r = decideFirstAssign({
      timedOut: false,
      ml: { staffId: 2, confidence: 0.8, reason: 'ml' },
      pool,
      score: 80,
    });
    expect(r.strategy).toBe('ai_analytics');
    expect(r.ownerId).toBe(2);
  });

  it('B2B-09 hybrid_timeout', () => {
    const r = decideFirstAssign({ timedOut: true, ml: null, pool, score: 80 });
    expect(r.strategy).toBe('hybrid_timeout');
    expect(r.ownerId).toBe(2);
  });

  it('empty pool → null owner', () => {
    const r = decideFirstAssign({ timedOut: false, ml: null, pool: [], score: 50 });
    expect(r.ownerId).toBeNull();
    expect(r.strategy).toBe('hybrid');
  });
});
