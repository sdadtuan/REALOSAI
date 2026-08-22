import { computeBriefReadiness, BRIEF_READINESS_LOW_THRESHOLD } from './marketing-ai-brief-readiness.util';
import { extractBriefFieldsFromText } from './marketing-ai-brief-upload.util';
import { kpiTreeIsComplete, normalizeKpiTree, suggestKpiTreeFromContext } from './marketing-ai-kpi-tree.util';

describe('marketing-ai-brief-readiness.util', () => {
  it('scores low when required fields missing', () => {
    const r = computeBriefReadiness({});
    expect(r.score).toBeLessThan(BRIEF_READINESS_LOW_THRESHOLD);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it('scores high when brief complete', () => {
    const r = computeBriefReadiness({
      brand_name: 'ABC Logistics',
      industry: 'Logistics',
      service_slug: 'meta-lead-gen',
      objective: 'lead',
      budget_monthly_vnd: 80_000_000,
      geo_markets: ['HCM'],
      challenges: 'CPL cao',
      usp: 'Same-day delivery',
      competitors: ['GHTK'],
    });
    expect(r.score).toBeGreaterThanOrEqual(BRIEF_READINESS_LOW_THRESHOLD);
  });
});

describe('marketing-ai-brief-upload.util', () => {
  it('extracts labeled fields from plain text', () => {
    const text = `
Thương hiệu: ABC Logistics
Ngành: Logistics
Mục tiêu: lead
Ngân sách tháng: 80 triệu
Thị trường: HCM, Bình Dương
Thách thức: CPL cao, thiếu lead chất lượng
`;
    const fields = extractBriefFieldsFromText(text);
    expect(fields.brand_name).toContain('ABC');
    expect(fields.budget_monthly_vnd).toBe(80_000_000);
    expect(fields.geo_markets).toEqual(['HCM', 'Bình Dương']);
  });
});

describe('marketing-ai-kpi-tree.util', () => {
  it('normalizes empty tree to north star root', () => {
    const tree = normalizeKpiTree([]);
    expect(tree[0]?.id).toBe('north_star');
  });

  it('detects incomplete vs complete tree', () => {
    expect(kpiTreeIsComplete([])).toBe(false);
    expect(
      kpiTreeIsComplete([
        {
          id: 'north_star',
          label: 'CPL',
          target: '< 500k',
          children: [{ id: 'c1', label: 'Meta', target: '200 leads' }],
        },
      ]),
    ).toBe(true);
  });

  it('suggests tree from campaigns', () => {
    const tree = suggestKpiTreeFromContext(
      { objective: 'lead', budget_monthly_vnd: 50_000_000 },
      [{ name: 'Meta Lead', objective: 'CPL', channel_mix: ['meta'], budget_pct: 60, kpis: ['CPL < 400k'] }],
    );
    expect(tree[0]?.children?.[0]?.label).toBe('Meta Lead');
  });
});
