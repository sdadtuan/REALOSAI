import {
  applyScenarioToCampaigns,
  buildBudgetScenarios,
  formatCplLabel,
} from './marketing-ai-budget.util';

describe('marketing-ai-budget.util', () => {
  const brief = {
    brand_name: 'Acme',
    objective: 'lead' as const,
    budget_monthly_vnd: 100_000_000,
    geo_markets: ['HCM'],
  };

  it('buildBudgetScenarios returns 3 lead scenarios', () => {
    const rows = buildBudgetScenarios(brief);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.slug)).toEqual(['conservative', 'balanced', 'aggressive']);
    expect(rows[1].channel_mix_json.meta_pct).toBe(35);
    expect(rows[1].cpl_estimates_json.blended_cpl_vnd).toBe(195_000);
  });

  it('applyScenarioToCampaigns maps buckets to campaigns', () => {
    const campaigns = [
      {
        name: 'Meta Lead Gen',
        objective: 'lead',
        channel_mix: ['Meta'],
        budget_pct: 10,
      },
      {
        name: 'Google Search',
        objective: 'lead',
        channel_mix: ['Google Search'],
        budget_pct: 10,
      },
    ];
    const out = applyScenarioToCampaigns(campaigns, {
      meta_pct: 40,
      google_pct: 35,
      content_pct: 10,
      reserve_pct: 15,
    });
    expect(out[0].budget_pct).toBeCloseTo(53.3, 1);
    expect(out[1].budget_pct).toBeCloseTo(46.7, 1);
    expect(out.reduce((s, c) => s + c.budget_pct, 0)).toBeCloseTo(100, 0);
  });

  it('formatCplLabel for lead uses k suffix', () => {
    expect(formatCplLabel(195_000, 'lead')).toBe('195k');
  });
});
