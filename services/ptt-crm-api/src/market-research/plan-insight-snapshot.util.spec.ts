import { assertNoInsightTextLeak, freezePlanInsights } from './plan-insight-snapshot.util';

describe('freezePlanInsights', () => {
  it('snapshot keys only client_id|insight_ids|inserted_at|inserted_by', () => {
    const snap = freezePlanInsights({
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

  it('rejects persist payload that copies excerpt', () => {
    expect(() =>
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        excerpt: 'locked excerpt',
      }),
    ).toThrow('plan_must_not_copy_insight_text');
  });

  it('allows freeze snapshot with ids only', () => {
    expect(() =>
      assertNoInsightTextLeak({
        client_id: 'acme',
        insight_ids: [7],
        inserted_at: '2026-08-14T05:00:00.000Z',
        inserted_by: 'am@ptt',
      }),
    ).not.toThrow();
  });
});
