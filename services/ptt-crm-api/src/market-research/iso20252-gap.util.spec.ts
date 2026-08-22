import {
  ISO_GAP_BANNER,
  buildIso20252GapCheck,
  summarizeIsoGapItems,
  type IsoGapInput,
} from './iso20252-gap.util';

const EMPTY: IsoGapInput = {
  project: {
    decision_statement: '',
    product_type: '',
    dv12_tier: 'CB',
    geo: [],
  },
  rq_count: 0,
  source_count: 0,
  verified_evidence_count: 0,
  study_count: 0,
  ai_run_count: 0,
  insight_counts: { draft: 0, published: 0, approved_client_facing: 0 },
  acf_with_verified_evidence: 0,
  review_count: 0,
  latest_report: null,
};

describe('iso20252-gap.util', () => {
  it('P37 banner does not claim ISO certification', () => {
    expect(ISO_GAP_BANNER).toMatch(/Gap-check nội bộ/);
    expect(ISO_GAP_BANNER).toMatch(/không chứng nhận/);
    expect(ISO_GAP_BANNER).not.toMatch(/ISO certified|đạt chuẩn ISO 20252/i);
  });

  it('P37 empty project fails planning and execution checks', () => {
    const items = buildIso20252GapCheck(EMPTY);
    const byId = Object.fromEntries(items.map((row) => [row.id, row.status]));

    expect(byId.decision_statement).toBe('fail');
    expect(byId.has_rq).toBe('fail');
    expect(byId.product_type).toBe('fail');
    expect(byId.geo).toBe('fail');
    expect(byId.has_source).toBe('fail');
    expect(byId.has_verified_evidence).toBe('fail');
    expect(byId.has_study_or_desk).toBe('fail');
    expect(byId.has_report_version).toBe('fail');
  });

  it('P37 TC fixture with verified evidence and report returns mixed pass/partial', () => {
    const items = buildIso20252GapCheck({
      project: {
        decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
        product_type: 'CAT_REVIEW',
        dv12_tier: 'TC',
        geo: ['VN'],
      },
      rq_count: 2,
      source_count: 3,
      verified_evidence_count: 4,
      study_count: 0,
      ai_run_count: 1,
      insight_counts: { draft: 1, published: 0, approved_client_facing: 1 },
      acf_with_verified_evidence: 1,
      review_count: 2,
      latest_report: {
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        findings_count: 2,
      },
    });

    const byId = Object.fromEntries(items.map((row) => [row.id, row.status]));
    expect(byId.decision_statement).toBe('pass');
    expect(byId.has_verified_evidence).toBe('pass');
    expect(byId.methodology_not_stub).toBe('partial');
    expect(byId.report_has_findings).toBe('pass');
    expect(summarizeIsoGapItems(items).fail).toBe(0);
  });

  it('P37 CB tier allows methodology stub', () => {
    const items = buildIso20252GapCheck({
      ...EMPTY,
      project: {
        decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
        product_type: 'CAT_REVIEW',
        dv12_tier: 'CB',
        geo: ['VN'],
      },
      rq_count: 1,
      source_count: 1,
      verified_evidence_count: 1,
      latest_report: {
        methodology: { stub: true, population: '', source_plan: '', limitation: '' },
        findings_count: 1,
      },
    });

    expect(items.find((row) => row.id === 'methodology_not_stub')?.status).toBe('pass');
  });
});
