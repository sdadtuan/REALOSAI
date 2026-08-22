import {
  assertManualSplitChoice,
  ManualSplitRequiredError,
  resolveManualSplitCommission,
} from './b2b-manual-reassign.util';

describe('b2b-manual-reassign.util', () => {
  it('requires split choice', () => {
    expect(() => assertManualSplitChoice(undefined)).toThrow(/split_required/);
    expect(() => assertManualSplitChoice(undefined)).toThrow(ManualSplitRequiredError);
  });

  it('no_split skips commission update', () => {
    const out = resolveManualSplitCommission({
      choice: 'no_split',
      projectFirstTouchPct: 30,
      projectCloserPct: 70,
    });
    expect(out.updateCommissionSplit).toBe(false);
  });

  it('keep_first_touch preserves existing pct', () => {
    const out = resolveManualSplitCommission({
      choice: 'keep_first_touch',
      projectFirstTouchPct: 30,
      projectCloserPct: 70,
      existingFirstTouchPct: 40,
      existingCloserPct: 60,
    });
    expect(out).toEqual({ firstTouchPct: 40, closerPct: 60, updateCommissionSplit: true });
  });

  it('reset_closer uses project pct', () => {
    const out = resolveManualSplitCommission({
      choice: 'reset_closer',
      projectFirstTouchPct: 30,
      projectCloserPct: 70,
      existingFirstTouchPct: 40,
      existingCloserPct: 60,
    });
    expect(out).toEqual({ firstTouchPct: 30, closerPct: 70, updateCommissionSplit: true });
  });
});
