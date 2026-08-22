import { buildReportSnapshot } from './market-research-report-snapshot.util';

describe('buildReportSnapshot', () => {
  const project = {
    client_id: 'acme',
    client_name: 'Acme Dairy',
    title: 'Category review sữa uống 2026',
    decision_statement: 'Quyết định có mở SKU premium Q4 hay không.',
  };

  const insights = [
    {
      id: 11,
      statement: 'Premium SKU tăng share ở MT HCM',
      recommendation: 'Mở SKU premium tại HCM trước',
      observation: 'Share +2pp',
      evidence_ids: [3],
    },
    {
      id: 12,
      statement: 'Giá trị kênh GT còn mỏng',
      recommendation: 'Không mở GT trong Q4',
      observation: null,
      evidence_ids: [],
    },
  ];

  const questions = [{ id: 21, question_vi: 'Quy mô thị trường sữa uống VN?', sort_order: 1 }];
  const evidence = [{ id: 3, locator: 'https://example.com#p3', question_id: 21 }];

  it('includes evidence_index length ≥ 1 when a selected insight has EV', () => {
    const snapshot = buildReportSnapshot({
      project,
      insights,
      questions,
      evidence,
      selectedInsightIds: [11],
      version: 1,
    });

    expect(Array.isArray(snapshot.evidence_index)).toBe(true);
    expect(snapshot.evidence_index.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.evidence_index[0]).toEqual({
      ev_id: 3,
      locator: 'https://example.com#p3',
      insight_id: 11,
    });
  });

  it('pins cover.client and cover.title from project fields, ignoring LLM cover', () => {
    const snapshot = buildReportSnapshot({
      project,
      insights,
      questions,
      evidence,
      selectedInsightIds: [11],
      version: 2,
      llmDraft: {
        cover: { client: 'HALLUCINATED', title: 'Wrong title from model' },
        exec: 'LLM exec',
        findings: [{ insight_id: 11, text: 'ok' }, { insight_id: 99, text: 'drop' }],
        recs: [{ insight_id: 11, text: 'ok' }, { insight_id: 12, text: 'unselected' }],
      },
    });

    expect(snapshot.cover.client).toBe('Acme Dairy');
    expect(snapshot.cover.title).toBe('Category review sữa uống 2026');
    expect(snapshot.cover.version).toBe(2);
    expect(JSON.stringify(snapshot.cover)).not.toContain('HALLUCINATED');
    expect(snapshot.findings.every((row) => Number(row.insight_id) === 11)).toBe(true);
    expect(snapshot.recs.every((row) => Number(row.insight_id) === 11)).toBe(true);
    expect(snapshot.exec).toEqual({ vi: 'LLM exec', en: null, en_status: 'none' });
  });

  it('normalizes decision_statement string exec for P0 versions', () => {
    const snapshot = buildReportSnapshot({
      project,
      insights,
      questions,
      evidence,
      selectedInsightIds: [11],
      version: 1,
    });
    expect(snapshot.exec).toEqual({
      vi: 'Quyết định có mở SKU premium Q4 hay không.',
      en: null,
      en_status: 'none',
    });
  });
});
