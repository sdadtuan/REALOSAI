import { buildPresalesMktAiBrief, mapStrategyToPreliminaryPlan } from './presales-ai-draft.util';

describe('presales-ai-draft.util', () => {
  it('buildPresalesMktAiBrief maps consult highlights and lead form', () => {
    const brief = buildPresalesMktAiBrief({
      serviceSlug: 'meta-lead-gen',
      leadName: 'Công ty ABC',
      consultBrief: {
        company_name: 'Công ty ABC',
        highlights: {
          niche: 'Spa',
          pain: 'Thiếu lead chất lượng',
          budget_vnd: 30_000_000,
          goal: 'lead',
        },
        lead_task: {
          form_data: { need: 'CPL cao' },
        },
      },
    });

    expect(brief.service_slug).toBe('meta-lead-gen');
    expect(brief.brand_name).toBe('Công ty ABC');
    expect(brief.industry).toBe('Spa');
    expect(brief.challenges).toBe('Thiếu lead chất lượng');
    expect(brief.budget_monthly_vnd).toBe(30_000_000);
    expect(brief.objective).toBe('lead');
  });

  it('mapStrategyToPreliminaryPlan fills gate G4 fields from strategy output', () => {
    const patch = mapStrategyToPreliminaryPlan(
      {
        strategy_framework: {
          target_market: 'Spa cao cấp tại HCM.',
          market_message: 'Trải nghiệm 5 sao',
          media_reach: 'Meta + Google',
          conversion_strategy: 'Landing + form',
        },
        target_market_prof: { market_context: 'Thị trường spa' },
        swot_json: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
      },
      {
        leadId: 42,
        serviceSlug: 'meta-lead-gen',
        brief: { brand_name: 'Spa X', objective: 'lead', challenges: 'Thiếu lead' },
      },
    );

    expect(patch.name).toContain('Lead #42');
    expect(patch.north_star).toContain('Spa cao cấp');
    expect(patch.objectives).toContain('Thiếu lead');
    expect(patch.strategy_framework?.market_message).toBe('Trải nghiệm 5 sao');
    expect(patch.strategy_framework?.media_reach).toBe('Meta + Google');
    expect(patch.strategy_framework?.conversion_strategy).toBe('Landing + form');
    expect(patch.target_market_prof?.market_context).toBe('Thị trường spa');
  });
});
