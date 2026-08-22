import { assertStageTransition } from './vd-stage.guard';

describe('vd-stage.guard', () => {
  it('allows staying on brief_draft', () => {
    expect(() => assertStageTransition('brief_draft', 'brief_draft')).not.toThrow();
  });

  it('blocks S1 jump to keyframing', () => {
    expect(() => assertStageTransition('brief_draft', 'keyframing')).toThrow(/stage_guard/);
  });

  it('allows brief_draft to brief_ready', () => {
    expect(() => assertStageTransition('brief_draft', 'brief_ready')).not.toThrow();
  });

  it('allows brief_ready to scripting', () => {
    expect(() => assertStageTransition('brief_ready', 'scripting')).not.toThrow();
  });

  it('still blocks brief_draft to keyframing', () => {
    expect(() => assertStageTransition('brief_draft', 'keyframing')).toThrow(/stage_guard/);
  });

  it('allows brief_ready to ideation', () => {
    expect(() => assertStageTransition('brief_ready', 'ideation')).not.toThrow();
  });

  it('allows ideation to scripting', () => {
    expect(() => assertStageTransition('ideation', 'scripting')).not.toThrow();
  });

  it('allows scripting to shotlist_ready', () => {
    expect(() => assertStageTransition('scripting', 'shotlist_ready')).not.toThrow();
  });

  it('blocks keyframing without gate1 approved', () => {
    expect(() => assertStageTransition('shotlist_ready', 'keyframing', { gate1: 'pending' })).toThrow(
      /stage_guard/,
    );
  });

  it('allows keyframing when gate1 approved', () => {
    expect(() =>
      assertStageTransition('shotlist_ready', 'keyframing', { gate1: 'approved' }),
    ).not.toThrow();
  });

  it('blocks animating when gate2 is not approved', () => {
    expect(() => assertStageTransition('keyframing', 'animating', { gate2: 'pending' })).toThrow(
      /stage_guard/,
    );
  });

  it('allows animating when gate2 approved', () => {
    expect(() =>
      assertStageTransition('keyframing', 'animating', { gate2: 'approved' }),
    ).not.toThrow();
  });
});
