import { computeDealScoreV1 } from './deal-score.engine';
import { DealScoreContext } from './deal-score.types';

describe('computeDealScoreV1', () => {
  const now = new Date('2026-07-26T12:00:00Z');

  function ctx(partial: Partial<DealScoreContext>): DealScoreContext {
    return {
      dealId: 1,
      clientId: null,
      title: 'Deal test',
      pipelineStage: 'sql',
      isTerminal: false,
      dealValueVnd: 50_000_000,
      stageEnteredAt: new Date('2026-07-20T12:00:00Z'),
      updatedAt: new Date('2026-07-20T12:00:00Z'),
      lastActivityAt: new Date('2026-07-24T12:00:00Z'),
      activityCount7d: 2,
      status: 'dang_xu_ly',
      ...partial,
    };
  }

  it('scores open deal with explainability factors', () => {
    const out = computeDealScoreV1(ctx({}), now);
    expect(out.score).toBeGreaterThan(40);
    expect(out.explainability.factors.length).toBeGreaterThanOrEqual(2);
  });

  it('marks stalled deal when no activity 7d', () => {
    const out = computeDealScoreV1(
      ctx({
        lastActivityAt: new Date('2026-07-10T12:00:00Z'),
        stageEnteredAt: new Date('2026-07-10T12:00:00Z'),
        activityCount7d: 0,
      }),
      now,
    );
    expect(out.isStalled).toBe(true);
    expect(out.stalledDays).toBeGreaterThanOrEqual(7);
  });
});
