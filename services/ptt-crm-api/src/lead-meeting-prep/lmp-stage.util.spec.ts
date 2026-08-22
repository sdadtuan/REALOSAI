import {
  buildLmpIdempotencyKey,
  PREP_STAGE_LABEL_VI,
  resolveModeForStage,
} from './lmp-stage.util';

describe('lmp-stage.util', () => {
  it('maps stages to modes', () => {
    expect(resolveModeForStage('m1_first_strike')).toBe('full');
    expect(resolveModeForStage('m3_pre_close')).toBe('strategize_arm');
    expect(
      resolveModeForStage('m2_qualify_win', { hasCollect: true, collectFresh: true }),
    ).toBe('strategize_arm');
    expect(resolveModeForStage('m2_qualify_win', { hasCollect: true, collectFresh: false })).toBe(
      'refresh',
    );
  });

  it('builds stage-scoped idempotency keys', () => {
    expect(buildLmpIdempotencyKey(7, 'm2_qualify_win', false)).toBe(
      'lead_meeting_prep:lead:7:stage:m2_qualify_win',
    );
    expect(buildLmpIdempotencyKey(7, 'm3_pre_close', true)).toMatch(
      /^lead_meeting_prep:lead:7:stage:m3_pre_close:manual:/,
    );
  });

  it('has Vietnamese labels for all stages', () => {
    expect(PREP_STAGE_LABEL_VI.m1_first_strike).toContain('M1');
    expect(PREP_STAGE_LABEL_VI.m2_qualify_win).toContain('M2');
    expect(PREP_STAGE_LABEL_VI.m3_pre_close).toContain('M3');
    expect(PREP_STAGE_LABEL_VI.m4_learn).toContain('M4');
    expect(resolveModeForStage('m4_learn')).toBe('learn');
  });
});
