import {
  buildSolutionHandoffActivity,
  SOLUTION_HANDOFF_ACTIVITY_TYPES,
} from './presales-solution-handoff-activity.util';

describe('presales-solution-handoff-activity.util', () => {
  const base = {
    leadId: 42,
    serviceSlug: 'seo',
    actorName: 'Nguyễn A',
  };

  it('builds handoff activity for AM', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.handoff, base);
    expect(out.activity_type).toBe('solution_handoff');
    expect(out.content).toContain('Nguyễn A');
    expect(out.content).toContain('lead #42');
    expect(out.content).toContain('(seo)');
    expect(out.next_action).toContain('/crm/solution/queue');
  });

  it('builds claimed activity', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.claimed, base);
    expect(out.activity_type).toBe('solution_claimed');
    expect(out.result).toContain('Consult + R5');
  });

  it('builds released activity with AM next action', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.released, {
      ...base,
      amOwnerName: 'Trần B',
    });
    expect(out.activity_type).toBe('solution_released');
    expect(out.next_action).toContain('AM Trần B');
    expect(out.result).toContain('proposal');
  });

  it('builds released activity without AM name', () => {
    const out = buildSolutionHandoffActivity(SOLUTION_HANDOFF_ACTIVITY_TYPES.released, base);
    expect(out.next_action).toBe('AM: tiếp tục Proposal trên lead');
  });
});
