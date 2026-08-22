import { prefillPresalesConsultTaskForm } from './presales-consult-prefill.util';
import type { PresalesTaskRow } from './leads-funnel.types';

describe('presales-consult-prefill.util', () => {
  it('prefills lead-gen consult from lead task and intake', () => {
    const consultTask: PresalesTaskRow = {
      id: 2,
      presales_id: 1,
      stage: 'consult',
      step_index: 0,
      title: 'Discovery funnel',
      description: '',
      form_fields: [],
      form_data: {},
      ai_prompt_key: 'consult_analysis',
      ai_output: '',
      is_done: false,
      done_at: '',
      notes: '',
    };
    const leadTask: PresalesTaskRow = {
      id: 1,
      presales_id: 1,
      stage: 'lead',
      step_index: 0,
      title: 'Qualify',
      description: '',
      form_fields: [],
      form_data: {
        niche: 'Spa B2B',
        need: 'Cần lead chất lượng',
        budget: 30000000,
        campaign_goal: 'Full funnel PTT',
      },
      ai_prompt_key: 'qualify_lead',
      ai_output: '',
      is_done: true,
      done_at: '',
      notes: '',
    };
    const out = prefillPresalesConsultTaskForm({
      serviceSlug: 'lead-gen',
      consultTask,
      leadTask,
      latestIntake: {
        id: 5,
        lead_id: 10,
        lifecycle_id: null,
        service_slug: 'lead-gen',
        mode: 'phone',
        status: 'completed',
        am_id: 1,
        contact_name: '',
        contact_role: '',
        company_name: '',
        source: '',
        bant_json: {},
        bant_total: 30,
        lead_temperature: 'hot',
        decision: 'go',
        decision_reason: '',
        answers_json: {},
        stakeholders_json: [],
        commitments_json: [],
        next_meeting_at: '',
        next_meeting_note: '',
        proposal_date: '',
        ai_summary: '',
        ai_suggested_questions: [],
        started_at: '',
        completed_at: '2026-08-05',
        created_at: '',
        updated_at: '',
      },
      overwrite: false,
    });
    expect(out.form_data.target_audience).toContain('Spa B2B');
    expect(out.form_data.conversion_metrics).toContain('30');
    expect(out.form_data.scope_recommendation).toContain('Full funnel');
    expect(out.filled.length).toBeGreaterThan(0);
  });

  it('prefills scope from SCI recommended DV codes', () => {
    const consultTask: PresalesTaskRow = {
      id: 2,
      presales_id: 1,
      stage: 'consult',
      step_index: 0,
      title: 'Discovery funnel',
      description: '',
      form_fields: [{ key: 'scope_recommendation', label: 'Scope' }],
      form_data: {},
      ai_prompt_key: 'consult_analysis',
      ai_output: '',
      is_done: false,
      done_at: '',
      notes: '',
    };
    const out = prefillPresalesConsultTaskForm({
      serviceSlug: 'lead-gen',
      consultTask,
      leadTask: null,
      latestIntake: null,
      recommendedDvCodes: ['DV02', 'DV05'],
    });
    expect(String(out.form_data.scope_recommendation)).toContain('DV02');
  });
});
