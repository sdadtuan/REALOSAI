import {
  buildInsightCopilotPrompt,
  redactEvidenceForAiRunLog,
  toInsightCopilotEvidenceFields,
  type InsightCopilotEvidence,
} from './market-research-copilot.prompt';
import type { CopilotRagHit } from './market-research.types';

const evA: InsightCopilotEvidence = {
  id: 11,
  locator: 'https://a.example#p1',
  excerpt: 'Share premium 18%',
  value: 18,
  unit: '%',
  period: '2025',
  geo: 'VN',
};

const evB: InsightCopilotEvidence = {
  id: 22,
  locator: 'https://b.example#t2',
  excerpt: 'Giá TB 45k',
  value: 45,
  unit: 'k VND',
  period: 'Q1-2026',
  geo: 'HCM',
};

describe('buildInsightCopilotPrompt', () => {
  it('includes only the given evidence IDs and allowed fields', () => {
    const { system, user } = buildInsightCopilotPrompt([evA, evB]);

    expect(user).toContain('"id":11');
    expect(user).toContain('"id":22');
    expect(user).not.toContain('33');
    expect(user).toContain('Share premium 18%');
    expect(user).toContain('https://a.example#p1');

    const parsed = JSON.parse(user.match(/\[[\s\S]*\]/)?.[0] ?? '[]') as Array<Record<string, unknown>>;
    expect(parsed).toHaveLength(2);
    for (const row of parsed) {
      expect(Object.keys(row).sort()).toEqual([
        'excerpt',
        'geo',
        'id',
        'locator',
        'period',
        'unit',
        'value',
      ]);
    }
    expect(user).not.toContain('pii_class');
    expect(user).not.toContain('created_by');
    expect(user).not.toContain('qc_status');
    expect(user).not.toContain('fill gaps');
    expect(system.toLowerCase()).toMatch(/do not fill gaps|cấm.*fill gaps|chỉ.*evidence/i);
  });

  it('does not mention evidence IDs that were not selected', () => {
    const { user } = buildInsightCopilotPrompt([evA]);
    expect(user).toContain('"id":11');
    expect(user).not.toContain('"id":22');
    expect(user).not.toContain('Giá TB 45k');
  });

  it('M1-2a: without opts user stays a P0 evidence array and system does not mention invent insight_id', () => {
    const { system, user } = buildInsightCopilotPrompt([evA]);
    const parsed = JSON.parse(user) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    const rows = parsed as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual([
      'excerpt',
      'geo',
      'id',
      'locator',
      'period',
      'unit',
      'value',
    ]);
    expect(user).not.toContain('prior_approved_insights');
    expect(system.toLowerCase()).not.toContain('invent insight_id');
  });

  it('M1-2b: ragHits wrap evidence and prior_approved_insights and forbid inventing insight_id', () => {
    const ragHits: CopilotRagHit[] = [
      {
        insight_id: 88,
        statement: 'Giá premium thắng',
        status: 'approved_client_facing',
        score: 0.4,
        theme_codes: ['PRICE'],
      },
    ];
    const { system, user } = buildInsightCopilotPrompt([evA], { ragHits });
    const parsed = JSON.parse(user) as {
      evidence: Array<{ id: number }>;
      prior_approved_insights: Array<{ insight_id: number }>;
    };
    expect(Array.isArray(parsed.evidence)).toBe(true);
    expect(parsed.evidence).toEqual([
      {
        id: 11,
        locator: 'https://a.example#p1',
        excerpt: 'Share premium 18%',
        value: 18,
        unit: '%',
        period: '2025',
        geo: 'VN',
      },
    ]);
    expect(parsed.evidence.map((row) => row.id)).toEqual([11]);
    expect(parsed.evidence.map((row) => row.id)).not.toContain(88);
    expect(parsed.prior_approved_insights[0].insight_id).toBe(88);
    expect(system).toMatch(/do not invent insight_id/i);
    expect(system).toContain('Never set status published');
    expect(system).toContain('Do not copy a prior statement as a published claim');
  });

  it('M1-2c: empty ragHits still emit prior_approved_insights and forbid inventing insight_id', () => {
    const { system, user } = buildInsightCopilotPrompt([evA], { ragHits: [] });
    const parsed = JSON.parse(user) as { prior_approved_insights: unknown[] };
    expect(parsed.prior_approved_insights).toEqual([]);
    expect(system).toMatch(/do not invent insight_id/i);
  });
});

describe('toInsightCopilotEvidenceFields', () => {
  it('maps repository columns onto the grounded field set only', () => {
    const fields = toInsightCopilotEvidenceFields({
      id: 3,
      project_id: 9,
      source_id: 1,
      study_id: null,
      question_id: 4,
      locator: 'https://example.com#p3',
      excerpt: 'locked excerpt',
      value_num: 12,
      unit: '%',
      value_base: 'SKU',
      period_note: '2024',
      geography: 'VN',
      captured_at: '2026-08-14',
      pii_class: 'internal',
      qc_status: 'verified',
      checksum: 'abc',
      created_by: 'am@ptt',
      superseded_by: null,
      created_at: '2026-08-14',
    });
    expect(fields).toEqual({
      id: 3,
      locator: 'https://example.com#p3',
      excerpt: 'locked excerpt',
      value: 12,
      unit: '%',
      period: '2024',
      geo: 'VN',
    });
  });
});

describe('redactEvidenceForAiRunLog', () => {
  it('redacts excerpt and value when pii_class is not none', () => {
    const logged = redactEvidenceForAiRunLog({
      id: 3,
      project_id: 9,
      source_id: 1,
      study_id: null,
      question_id: null,
      locator: 'https://example.com#p3',
      excerpt: 'SĐT 0901234567',
      value_num: 1,
      unit: null,
      value_base: null,
      period_note: null,
      geography: null,
      captured_at: '2026-08-14',
      pii_class: 'internal',
      qc_status: 'verified',
      checksum: null,
      created_by: 'am@ptt',
      superseded_by: null,
      created_at: '2026-08-14',
    });
    expect(logged.excerpt).toBe('[redacted]');
    expect(logged.value).toBeNull();
    expect(JSON.stringify(logged)).not.toContain('0901234567');
  });
});
