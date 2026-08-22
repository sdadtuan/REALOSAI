import { buildResearchPrefill, EMPTY_RESEARCH_PREFILL } from './research-prefill.util';

describe('buildResearchPrefill', () => {
  it('strips phone-like tokens such as 0909 from every returned string', () => {
    const out = buildResearchPrefill({
      industry: 'Sữa uống 0909123456',
      niche: 'Dairy',
      top_competitors: 'Vinamilk; TH True Milk 0909888777',
      phone: '0909123456',
      email: 'am@acme.vn',
      name: 'Nguyen Van A',
      contact_name: 'Tran Thi B',
    });
    const blob = JSON.stringify(out);
    expect(blob).not.toContain('0909');
    expect(blob).not.toContain('0909123456');
    expect(blob).not.toContain('0909888777');
    expect(blob).not.toContain('am@acme.vn');
    expect(blob).not.toContain('Nguyen Van A');
    expect(blob).not.toContain('Tran Thi B');
    expect(out.industry).toBe('Sữa uống');
    expect(out.competitor_names).toEqual(['Vinamilk', 'TH True Milk']);
    expect(out.suggested_rqs).toEqual([]);
  });

  it('returns empty prefill when form_data is missing', () => {
    expect(buildResearchPrefill(null)).toEqual(EMPTY_RESEARCH_PREFILL);
    expect(buildResearchPrefill({})).toEqual(EMPTY_RESEARCH_PREFILL);
  });

  it('reads niche when industry is absent and splits competitors on comma', () => {
    const out = buildResearchPrefill({
      niche: 'Spa B2B',
      competitors: 'A, B; C',
    });
    expect(out.industry).toBe('Spa B2B');
    expect(out.competitor_names).toEqual(['A', 'B', 'C']);
  });
});
