import {
  assessBriefReadiness,
  resolveBriefAudience,
  resolveBriefGoal,
} from './content-brief-readiness.util';

describe('content-brief-readiness.util', () => {
  it('flags missing audience and goal', () => {
    const out = assessBriefReadiness({ funnel_goal: '', brief_json: {} }, { audience: [] });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.missing_fields).toEqual(expect.arrayContaining(['audience', 'goal']));
    }
  });

  it('passes when audience in brand and goal on item', () => {
    const out = assessBriefReadiness(
      { funnel_goal: 'lead', brief_json: {} },
      { audience: ['B2B SaaS'] },
    );
    expect(out).toEqual({ ok: true });
  });

  it('resolves audience from brief_json', () => {
    expect(resolveBriefAudience({}, { audience: 'SMB owners' })).toBe('SMB owners');
    expect(resolveBriefGoal({ funnel_goal: 'awareness' }, undefined)).toBe('awareness');
  });
});
