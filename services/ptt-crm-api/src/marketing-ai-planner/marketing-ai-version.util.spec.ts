import { countTmmtFieldChanges, versionToDraft } from './marketing-ai-version.util';

describe('marketing-ai-version.util', () => {
  it('versionToDraft maps snapshot fields', () => {
    const draft = versionToDraft({
      id: 1,
      lifecycle_id: 1,
      version_no: 2,
      label: 'v2',
      status: 'approved',
      brief_json: { brand_name: 'Acme' },
      strategy_framework_json: { market_context: 'a' },
      target_market_prof_json: { segmentation_icp: 'b' },
      campaigns_json: [{ name: 'C1', objective: 'lead', channel_mix: [], budget_pct: 100 }],
      content_json: {},
      quality_score_json: { score: 70 },
      marketing_plan_id: null,
      applied_at: null,
      created_by: 'u@test.vn',
      created_at: '2026-01-01T00:00:00Z',
    });
    expect(draft.strategy_framework.market_context).toBe('a');
    expect(draft.campaigns_json).toHaveLength(1);
  });

  it('countTmmtFieldChanges detects diffs', () => {
    const n = countTmmtFieldChanges(
      { target_market: 'a' },
      { segmentation_icp: 'x' },
      { target_market: 'b' },
      { segmentation_icp: 'x' },
    );
    expect(n).toBeGreaterThanOrEqual(1);
  });
});
