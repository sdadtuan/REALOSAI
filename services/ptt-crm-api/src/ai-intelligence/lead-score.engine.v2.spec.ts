import { computeFeedbackScoreAdjustment, computeLeadScoreV1, computeLeadScoreV2 } from './lead-score.engine';
import type { LeadScoreContext } from './lead-score.types';

describe('lead-score.engine v2', () => {
  const baseCtx: LeadScoreContext = {
    leadId: 42,
    clientId: null,
    channel: 'meta',
    source: 'facebook',
    campaignId: 'camp-1',
    externalLeadId: 'ext-1',
    status: 'new',
    isDuplicate: false,
    receivedAt: new Date('2026-07-26T08:00:00Z'),
    createdAt: new Date('2026-07-26T08:00:00Z'),
    firstContactAt: new Date('2026-07-26T08:10:00Z'),
    timelineEventCount: 2,
    meta: {},
    estimatedDealValueVnd: 80_000_000,
  };

  it('matches v1 when no feedback rows', () => {
    const v1 = computeLeadScoreV1(baseCtx, new Date('2026-07-26T09:00:00Z'));
    const v2 = computeLeadScoreV2(baseCtx, null, new Date('2026-07-26T09:00:00Z'));
    expect(v2.score).toBe(v1.score);
  });

  it('boosts score when lead chốt with high override history', () => {
    const v1 = computeLeadScoreV1(baseCtx, new Date('2026-07-26T09:00:00Z'));
    const v2 = computeLeadScoreV2(
      baseCtx,
      {
        override_count: 2,
        avg_override_score: 85,
        outcome_chot: 1,
        outcome_lost: 0,
        outcome_stalled: 0,
      },
      new Date('2026-07-26T09:00:00Z'),
    );
    expect(v2.score).toBeGreaterThan(v1.score);
    expect(v2.score - v1.score).toBeLessThanOrEqual(5);
    expect(v2.explainability.flags).toContain('score_v2_feedback');
  });

  it('caps feedback adjustment at ±5', () => {
    const adj = computeFeedbackScoreAdjustment({
      override_count: 5,
      avg_override_score: 90,
      outcome_chot: 5,
      outcome_lost: 5,
      outcome_stalled: 2,
    });
    expect(adj).toBeGreaterThanOrEqual(-5);
    expect(adj).toBeLessThanOrEqual(5);
  });

  it('reduces score on lost outcome signal', () => {
    const v1 = computeLeadScoreV1(baseCtx, new Date('2026-07-26T09:00:00Z'));
    const v2 = computeLeadScoreV2(
      baseCtx,
      {
        override_count: 0,
        avg_override_score: null,
        outcome_chot: 0,
        outcome_lost: 2,
        outcome_stalled: 0,
      },
      new Date('2026-07-26T09:00:00Z'),
    );
    expect(v2.score).toBeLessThan(v1.score);
  });
});
