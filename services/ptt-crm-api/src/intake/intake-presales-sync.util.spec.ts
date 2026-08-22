import { buildPresalesFormPatchFromIntake } from './intake-presales-sync.util';
import type { IntakeSessionRow } from './intake.types';

describe('buildPresalesFormPatchFromIntake', () => {
  it('maps need rich text to need_summary', () => {
    const session = {
      id: 5,
      bant_total: 21,
      decision: 'go',
      answers_json: {
        crm_fields: { need: '<p>Cần SEO tổng thể</p>' },
      },
    } as unknown as IntakeSessionRow;

    const patch = buildPresalesFormPatchFromIntake(session);
    expect(patch.need_summary).toBe('Cần SEO tổng thể');
    expect(patch.intake_session_id).toBe(5);
    expect(patch.bant_total).toBe(21);
    expect(patch.decision).toBe('go');
  });
});
