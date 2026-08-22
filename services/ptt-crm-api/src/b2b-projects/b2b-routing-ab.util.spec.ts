import { assignAbBucket, decideFirstAssignWithAb } from './b2b-routing-ab.util';

describe('b2b-routing-ab.util', () => {
  const pool = [
    { staffId: 1, salesLevel: 's', openFirstTouch: 2, inCall: false },
    { staffId: 2, salesLevel: 'a', openFirstTouch: 0, inCall: false },
  ];

  it('assignAbBucket is stable for leadId', () => {
    expect(assignAbBucket(42)).toBe(assignAbBucket(42));
    expect(['ai_analytics', 'hybrid']).toContain(assignAbBucket(42));
  });

  it('forces hybrid in gray zone when bucket is hybrid', () => {
    const r = decideFirstAssignWithAb({
      timedOut: false,
      ml: { staffId: 2, confidence: 0.76, reason: 'ml pick' },
      pool,
      score: 80,
      abBucket: 'hybrid',
    });
    expect(r.strategy).toBe('hybrid');
    expect(r.ownerId).toBe(2);
  });

  it('allows ai_analytics in gray zone when bucket is ai_analytics', () => {
    const r = decideFirstAssignWithAb({
      timedOut: false,
      ml: { staffId: 2, confidence: 0.72, reason: 'ml pick' },
      pool,
      score: 80,
      abBucket: 'ai_analytics',
    });
    expect(r.strategy).toBe('ai_analytics');
    expect(r.ownerId).toBe(2);
  });
});
