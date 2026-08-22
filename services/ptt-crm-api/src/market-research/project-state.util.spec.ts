import { canTransitionProject } from './project-state.util';

const emptyCtx = { rqCount: 0, verifiedInsightCount: 0 };
const withRq = { rqCount: 1, verifiedInsightCount: 0 };
const withInsight = { rqCount: 1, verifiedInsightCount: 1 };

describe('canTransitionProject', () => {
  it('fails intake → designed when rqCount=0 with need_rq', () => {
    const result = canTransitionProject('intake', 'designed', emptyCtx);
    expect(result).toEqual({
      ok: false,
      error: 'invalid_transition',
      reason: 'need_rq',
    });
  });

  it('allows intake → designed when rqCount>=1', () => {
    expect(canTransitionProject('intake', 'designed', withRq)).toEqual({ ok: true });
  });

  it('fails approved → collecting with cannot_revert_approved', () => {
    const result = canTransitionProject('approved', 'collecting', withInsight);
    expect(result).toEqual({
      ok: false,
      error: 'invalid_transition',
      reason: 'cannot_revert_approved',
    });
  });

  it.each([
    'intake',
    'designed',
    'collecting',
    'qc',
    'analyzing',
    'synthesizing',
    'drafting',
    'in_review',
    'approved',
    'distributed',
    'archived',
    'cancelled',
  ] as const)('allows %s → cancelled', (from) => {
    expect(canTransitionProject(from, 'cancelled', emptyCtx)).toEqual({ ok: true });
  });

  it('fails synthesizing → drafting when verifiedInsightCount=0', () => {
    const result = canTransitionProject('synthesizing', 'drafting', withRq);
    expect(result).toEqual({
      ok: false,
      error: 'invalid_transition',
      reason: 'need_verified_insight',
    });
  });

  it('allows synthesizing → drafting when verifiedInsightCount>=1', () => {
    expect(canTransitionProject('synthesizing', 'drafting', withInsight)).toEqual({ ok: true });
  });
});
