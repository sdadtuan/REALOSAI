import { RAG_COPILOT_HIT_LIMIT, type RagHit } from './market-research.types';
import {
  buildCopilotRagQuery,
  shouldSkipCopilotRag,
  toCopilotRagHits,
} from './research-copilot-rag.util';

function ragHit(overrides: {
  insight_id?: number;
  project_id?: number;
  statement?: string;
  status?: string;
  score?: number;
  theme_codes?: string[];
}): RagHit {
  return {
    insight_id: 1,
    project_id: 99,
    statement: 'stmt',
    status: 'approved_client_facing',
    score: 0.5,
    theme_codes: [],
    ...overrides,
  } as RagHit;
}

describe('buildCopilotRagQuery', () => {
  it('M1-1a: joins excerpt and geo and stays within 500 chars', () => {
    const query = buildCopilotRagQuery([
      {
        excerpt: 'Share 18%',
        locator: 'L1',
        unit: '%',
        geo: 'VN',
        id: 1,
        value: 18,
        period: '2025',
      },
    ]);
    expect(query).toContain('Share 18%');
    expect(query).toContain('VN');
    expect(query.length).toBeLessThanOrEqual(500);
  });
});

describe('shouldSkipCopilotRag', () => {
  it('M1-1b: skips PII and blank queries, keeps clean share text', () => {
    expect(shouldSkipCopilotRag('liên hệ 0901234567')).toBe(true);
    expect(shouldSkipCopilotRag('Share premium 18%')).toBe(false);
    expect(shouldSkipCopilotRag('   ')).toBe(true);
  });
});

describe('toCopilotRagHits', () => {
  it('M1-1c: drops draft and caps approved hits at RAG_COPILOT_HIT_LIMIT', () => {
    const draftPlusApproved = toCopilotRagHits([
      ragHit({ insight_id: 10, status: 'draft', statement: 'Draft leak' }),
      ragHit({
        insight_id: 20,
        status: 'approved_client_facing',
        statement: 'Approved keep',
      }),
    ]);
    expect(draftPlusApproved.map((hit) => hit.insight_id)).toEqual([20]);
    expect(draftPlusApproved).toHaveLength(1);

    const eightApproved = toCopilotRagHits(
      Array.from({ length: 8 }, (_, i) =>
        ragHit({ insight_id: i + 1, status: 'approved_client_facing' }),
      ),
    );
    expect(eightApproved).toHaveLength(5);
    expect(eightApproved.length).toBeLessThanOrEqual(RAG_COPILOT_HIT_LIMIT);

    const mixedEight = toCopilotRagHits([
      ragHit({ insight_id: 1, status: 'draft' }),
      ...Array.from({ length: 6 }, (_, i) =>
        ragHit({ insight_id: i + 2, status: 'approved_client_facing' }),
      ),
      ragHit({ insight_id: 8, status: 'approved_client_facing' }),
    ]);
    expect(mixedEight.every((hit) => hit.insight_id !== 1)).toBe(true);
    expect(mixedEight.length).toBeLessThanOrEqual(5);
  });
});
