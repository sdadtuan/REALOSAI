import {
  assessTmmtPrefillReadiness,
  buildTmmtPrefillFromL1AndConsult,
  TMMT_PREFILL_TARGET_SCORE,
} from './marketing-ai-tmmt-prefill.util';

describe('marketing-ai-tmmt-prefill.util', () => {
  it('maps consult + L1 to brief with l1-consult-bridge source', () => {
    const out = buildTmmtPrefillFromL1AndConsult({
      serviceSlug: 'meta-lead-gen',
      leadName: 'Acme Spa',
      consultBrief: {
        company_name: 'Acme Spa',
        highlights: {
          niche: 'Spa & Beauty',
          pain: 'CPL cao, thiếu lead chất lượng',
          budget_vnd: 25_000_000,
          goal: 'Tăng lead đặt lịch',
          domain: 'https://acme.vn',
        },
        lead_task: {
          form_data: {
            competitors: 'Spa X, Spa Y',
          },
        },
      },
      l1PlanRow: {
        name: 'KH MKT sơ bộ — Acme',
        north_star: 'ROAS 3x trong 90 ngày',
        objectives: '500 lead chất lượng/tháng',
        strategy_framework_json: JSON.stringify({
          target_market: 'Khách nữ 25-45 TP.HCM',
          market_message: 'Trải nghiệm premium',
          media_reach: 'Meta + Google + Zalo OA',
          conversion_strategy: 'Landing + retargeting',
        }),
      },
    });

    expect(out.sources).toContain('l1-consult-bridge');
    expect(out.brief.brand_name).toBe('Acme Spa');
    expect(out.brief.industry).toBe('Spa & Beauty');
    expect(out.brief.budget_monthly_vnd).toBe(25_000_000);
    expect(out.brief.competitors).toEqual(['Spa X', 'Spa Y']);
    expect(out.brief.usp).toBe('Trải nghiệm premium');
    expect(out.brief.geo_markets).toEqual(['Việt Nam']);
  });

  it('reaches ~80% brief readiness with consult + L1', () => {
    const { brief } = buildTmmtPrefillFromL1AndConsult({
      serviceSlug: 'meta-lead-gen',
      consultBrief: {
        company_name: 'Brand A',
        highlights: {
          niche: 'B2B SaaS',
          pain: 'Thiếu pipeline',
          budget_vnd: 30_000_000,
          goal: 'Lead B2B',
        },
      },
      l1PlanRow: {
        name: 'Plan A',
        north_star: 'Pipeline ổn định',
        strategy_framework_json: JSON.stringify({
          target_market: 'SMB VN',
          market_message: 'Giải pháp all-in-one',
          media_reach: 'LinkedIn + Meta',
          conversion_strategy: 'Demo booking',
        }),
      },
    });

    const readiness = assessTmmtPrefillReadiness(brief);
    expect(readiness.score).toBeGreaterThanOrEqual(TMMT_PREFILL_TARGET_SCORE);
    expect(readiness.meets_target).toBe(true);
  });
});
