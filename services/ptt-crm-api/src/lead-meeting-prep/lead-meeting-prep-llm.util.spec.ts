import { enforceContactPolicy, validatePrepResultShape } from './lead-meeting-prep-llm.util';

describe('LeadMeetingPrepLlmUtil', () => {
  it('forces contact_profile.found false', () => {
    const out = enforceContactPolicy({
      contact_profile: { found: true, summary: 'bad', facts: [{ x: 1 }] },
      company_profile: { summary: 'Co' },
      consulting_script: { opening: 'Hi' },
      recommended_services: [{ dv_code: 'DV02' }],
    });
    expect((out.contact_profile as { found: boolean }).found).toBe(false);
    expect((out.contact_profile as { facts: unknown[] }).facts).toEqual([]);
  });

  it('validates minimal prep shape', () => {
    expect(() =>
      validatePrepResultShape({
        contact_profile: { found: false, summary: 'policy', facts: [] },
        company_profile: { summary: 'ABC' },
        consulting_script: { opening: 'Xin chào' },
        recommended_services: [{ dv_code: 'DV02' }],
      }),
    ).not.toThrow();
  });
});
