import { buildWinOutcomeFromDebrief, winOutcomeHasDebrief } from './lmp-win-outcome.util';

describe('lmp-win-outcome.util', () => {
  it('builds win outcome from debrief', () => {
    const out = buildWinOutcomeFromDebrief({
      leadStatus: 'chot',
      metaJson: { deal_value_vnd: 15_000_000 },
      debrief: {
        closed_tier: 'TC',
        objection_faced: 'Đắt quá',
        am_feedback: 'ROI script OK',
        sci_helpful: true,
      },
      actorEmail: 'am@test.vn',
      prepStage: 'm3_pre_close',
    });
    expect(out.outcome).toBe('won');
    expect(out.closed_tier).toBe('TC');
    expect(out.deal_value_vnd).toBe(15_000_000);
    expect(out.submitted_by).toBe('am@test.vn');
  });

  it('detects debrief presence', () => {
    expect(winOutcomeHasDebrief({ submitted_at: 'x', closed_tier: 'CB' })).toBe(true);
    expect(winOutcomeHasDebrief({})).toBe(false);
  });
});
