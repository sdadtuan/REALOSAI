import {
  buildReviewQueueTriageStub,
  parseReviewQueueLlmOutput,
} from './review-queue-llm.util';
import { computeReviewQueuePriority } from './review-queue-intelligence.util';

describe('review-queue-llm.util', () => {
  const rulesBase = [
    {
      lead_id: 1,
      summary_line: 'Chờ 30h trong review queue — Quá 24h chưa hoàn thành B2',
      root_cause: 'no_b2' as const,
      suggested_owner_id: 10,
      suggested_owner_name: 'Rep A',
      suggest_reason: 'Gợi ý gán Rep A',
    },
  ];

  it('computes priority from hours waiting', () => {
    expect(computeReviewQueuePriority(50)).toBe(5);
    expect(computeReviewQueuePriority(26)).toBe(3);
    expect(computeReviewQueuePriority(8)).toBe(1);
  });

  it('parses LLM batch output and merges with rules base', () => {
    const out = parseReviewQueueLlmOutput(
      {
        items: [
          {
            lead_id: 1,
            summary_line: 'Lead 30h — ưu tiên gọi B2',
            priority_score: 4,
            suggested_owner_name: 'Rep B',
            workload_note: 'Rep B đang nhẹ queue',
            suggest_reason: 'SLA tốt + workload thấp',
          },
        ],
      },
      rulesBase,
    );
    expect(out[0].priority_score).toBe(4);
    expect(out[0].suggested_owner_name).toBe('Rep B');
    expect(out[0].workload_note).toContain('Rep B');
    expect(out[0].triage_source).toBe('llm');
  });

  it('builds stub triage from rules', () => {
    const out = buildReviewQueueTriageStub(rulesBase);
    expect(out[0].triage_source).toBe('llm_stub');
    expect(out[0].priority_score).toBe(3);
  });
});
