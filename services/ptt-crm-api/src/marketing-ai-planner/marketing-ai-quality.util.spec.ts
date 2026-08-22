import { emptyDraft } from './marketing-ai-brief.util';
import { computeQualityScore } from './marketing-ai-quality.util';

describe('marketing-ai-quality.util', () => {
  it('returns low score for empty draft', () => {
    const result = computeQualityScore(null, emptyDraft() as never);
    expect(result.score).toBeLessThan(60);
    expect(result.can_apply).toBe(false);
    expect(result.can_export).toBe(false);
  });

  it('scores higher when brief and draft are populated', () => {
    const draft = emptyDraft();
    draft.strategy_framework = { target_market: 'SMB Việt Nam' };
    draft.target_market_prof = {
      segmentation_icp:
        'Doanh nghiệp B2B 10–50 nhân sự, ngân sách ads 15–30 triệu/tháng, cần lead chất lượng từ Meta.',
      insights_evidence: 'Pain: lead rác, CPL cao',
    };
    draft.campaigns_json = [
      {
        name: 'Lead gen Q3',
        objective: 'lead',
        channel_mix: ['meta', 'google'],
        budget_pct: 60,
        kpis: ['CPL', 'MQL'],
      },
    ];

    const result = computeQualityScore(
      {
        brand_name: 'Acme',
        challenges: 'Lead chất lượng thấp',
        budget_monthly_vnd: 20000000,
        competitors: ['Comp A'],
      },
      draft as never,
    );

    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.can_apply).toBe(true);
    expect(result.can_export).toBe(true);
  });
});
