import { mergeBrief, validateMktAiBrief } from './marketing-ai-brief.util';

describe('marketing-ai-brief.util', () => {
  it('flags missing required fields in Vietnamese', () => {
    const result = validateMktAiBrief({});
    expect(result.ok).toBe(false);
    expect(result.missing).toContain('brand_name');
    expect(result.messages.some((m) => m.includes('Tên thương hiệu'))).toBe(true);
  });

  it('merges patch arrays and budget', () => {
    const merged = mergeBrief(
      { brand_name: 'Acme', service_slug: 'meta-ads' },
      {
        geo_markets: 'Hà Nội, TP.HCM',
        budget_monthly_vnd: '15000000',
        challenges: 'Lead chất lượng thấp',
      },
    );
    expect(merged.geo_markets).toEqual(['Hà Nội', 'TP.HCM']);
    expect(merged.budget_monthly_vnd).toBe(15000000);
    expect(merged.brand_name).toBe('Acme');
  });

  it('passes validation when required fields present', () => {
    const brief = mergeBrief(null, {
      brand_name: 'Acme',
      industry: 'B2B SaaS',
      service_slug: 'meta-ads',
      objective: 'lead',
      budget_monthly_vnd: 20000000,
      geo_markets: ['Việt Nam'],
      challenges: 'CAC cao',
    });
    const result = validateMktAiBrief(brief);
    expect(result.ok).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
