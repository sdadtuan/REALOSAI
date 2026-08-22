import {
  assertNoInsightTextLeak,
  freezeContentInsights,
  stripContentResearchFromBrief,
} from './content-insight-snapshot.util';

describe('freezeContentInsights', () => {
  it('snapshot keys only client_id|insight_ids|inserted_at|inserted_by', () => {
    const snap = freezeContentInsights({
      client_id: ' acme ',
      insight_ids: [7, 7, 0, -1, 12],
      inserted_by: 'am@ptt',
      now: '2026-08-14T05:00:00.000Z',
    });

    expect(Object.keys(snap).sort()).toEqual(
      ['client_id', 'inserted_at', 'inserted_by', 'insight_ids'].sort(),
    );
    expect(snap).toEqual({
      client_id: 'acme',
      insight_ids: [7, 12],
      inserted_at: '2026-08-14T05:00:00.000Z',
      inserted_by: 'am@ptt',
    });
    expect(JSON.stringify(snap)).not.toContain('statement');
    expect(JSON.stringify(snap)).not.toContain('excerpt');
  });
});

describe('assertNoInsightTextLeak', () => {
  it('rejects persist payload that copies statement', () => {
    expect(() =>
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        statement: 'Premium SKU tăng share ở MT HCM',
      }),
    ).toThrow('plan_must_not_copy_insight_text');
    try {
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        statement: 'Premium SKU tăng share ở MT HCM',
      });
    } catch (err) {
      expect((err as Error & { code: string }).code).toBe('plan_must_not_copy_insight_text');
    }
  });
});

describe('stripContentResearchFromBrief', () => {
  it('removes market_research and keeps other brief keys', () => {
    const next = stripContentResearchFromBrief({
      market_research: { insight_ids: [1] },
      hook: 'x',
    });
    expect(next).toEqual({ hook: 'x' });
    expect(next).not.toHaveProperty('market_research');
  });
});
