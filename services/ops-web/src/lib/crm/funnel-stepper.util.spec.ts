import { describe, expect, it } from 'vitest';
import type { LeadFunnelSnapshot } from '@/lib/api';
import type { ConsultGateState, IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import {
  presalesStageIndex,
  resolveActiveStep,
  resolveFunnelStepper,
  resolveGateStrip,
  resolvePresalesStepStates,
  resolvePrimaryAction,
  resolveSecondaryAction,
  shouldConfirmPresalesAdvance,
} from '@/lib/crm/funnel-stepper.util';

function mockFunnel(overrides: Partial<LeadFunnelSnapshot> = {}): LeadFunnelSnapshot {
  return {
    lead_id: 900000002,
    lead_flow_kind: 'b2b_prospect',
    care_pipeline: {
      current_stage_key: 'first_contact',
      current_stage_label: 'Liên hệ',
      all_complete: true,
      contact_ok_reported: true,
      stages: [],
    },
    presales_care_gate: { complete: true, message: 'OK' },
    review_queue: { active: false },
    presales_on_lead_enabled: true,
    presales: {
      presales: {
        id: 1,
        stage: 'lead',
        service_slug: 'dich-vu-seo-tong-the',
        status: 'active',
      },
      tasks: { lead: [{ id: 10, title: 'Lead task', is_done: true }] },
      advance: {
        can_advance_forward: false,
        block_reason: 'Sẵn sàng chuyển Tư vấn',
        next_stage: 'consult',
      },
    },
    ...overrides,
  };
}

function mockGate(overrides: Partial<ConsultGateState> = {}): ConsultGateState {
  return {
    ok: true,
    level: 'ok',
    messages: ['Sẵn sàng chuyển Tư vấn'],
    requires_confirm: false,
    requires_override: false,
    bant_total: 26,
    decision: 'go',
    ...overrides,
  };
}

function mockIntake(overrides: Partial<IntakeStepSummary> = {}): IntakeStepSummary {
  return {
    has_draft: false,
    latest_completed: {
      id: 5,
      decision: 'go',
      bant_total: 26,
      completed_at: '2026-08-05T00:00:00Z',
    },
    ...overrides,
  };
}

describe('presalesStageIndex', () => {
  it('maps presales stages', () => {
    expect(presalesStageIndex('lead')).toBe(0);
    expect(presalesStageIndex('consult')).toBe(1);
    expect(presalesStageIndex('proposal')).toBe(2);
    expect(presalesStageIndex('unknown')).toBe(-1);
  });
});

describe('resolvePresalesStepStates', () => {
  it('blocks all steps when lead is in review queue', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel({ review_queue: { active: true, message: 'Chờ GDKD' } }),
      consultGate: null,
    });
    expect(states.intake_bant).toBe('blocked');
    expect(states.consult).toBe('blocked');
  });

  it('marks B2 current when care pipeline incomplete', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel({
        care_pipeline: {
          current_stage_key: 'first_contact',
          current_stage_label: 'Liên hệ',
          all_complete: false,
          contact_ok_reported: false,
          stages: [],
        },
        presales: null,
      }),
      consultGate: null,
    });
    expect(states.b2).toBe('current');
    expect(states.presales_lead).toBe('pending');
  });

  it('marks presales_lead current when B2 done but presales not started', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel({ presales: null }),
      consultGate: null,
    });
    expect(states.b2).toBe('done');
    expect(states.presales_lead).toBe('current');
    expect(states.intake_bant).toBe('pending');
  });

  it('keeps intake pending until presales exists', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel({ presales: null }),
      consultGate: null,
    });
    expect(states.intake_bant).toBe('pending');
  });

  it('marks intake current when draft session exists', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel(),
      consultGate: null,
      intakeSummary: { has_draft: true },
    });
    expect(states.intake_bant).toBe('current');
  });

  it('marks intake done when draft exists but completed Go gate ok', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel(),
      consultGate: mockGate(),
      intakeSummary: mockIntake({ has_draft: true }),
    });
    expect(states.intake_bant).toBe('done');
  });

  it('marks intake done when gate ok after completed Go session', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel(),
      consultGate: mockGate(),
      intakeSummary: mockIntake(),
    });
    expect(states.intake_bant).toBe('done');
  });

  it('marks intake warn when nurture gate requires confirm', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel(),
      consultGate: mockGate({
        ok: true,
        level: 'warn',
        requires_confirm: true,
        decision: 'nurture',
        messages: ['Nurture — cân nhắc trước khi chuyển Consult sâu'],
      }),
      intakeSummary: mockIntake({ latest_completed: { id: 5, decision: 'nurture', bant_total: 20, completed_at: '' } }),
    });
    expect(states.intake_bant).toBe('warn');
  });

  it('marks intake current when completed but gate blocks (lead task)', () => {
    const states = resolvePresalesStepStates({
      funnel: mockFunnel(),
      consultGate: mockGate({
        ok: false,
        level: 'block',
        messages: ['Hoàn thành task Lead trước khi chuyển Tư vấn'],
      }),
      intakeSummary: mockIntake(),
    });
    expect(states.intake_bant).toBe('current');
  });

  it('marks consult and proposal done/current by presales stage', () => {
    const consultStates = resolvePresalesStepStates({
      funnel: mockFunnel({
        presales: {
          presales: { id: 1, stage: 'consult', service_slug: 'x', status: 'active' },
          tasks: {},
          advance: { can_advance_forward: false, block_reason: '', next_stage: 'proposal' },
        },
      }),
      consultGate: null,
    });
    expect(consultStates.intake_bant).toBe('done');
    expect(consultStates.consult).toBe('current');
    expect(consultStates.proposal).toBe('pending');

    const proposalStates = resolvePresalesStepStates({
      funnel: mockFunnel({
        presales: {
          presales: { id: 1, stage: 'proposal', service_slug: 'x', status: 'active' },
          tasks: {},
          advance: { can_advance_forward: false, block_reason: '', next_stage: null },
        },
      }),
      consultGate: null,
    });
    expect(proposalStates.consult).toBe('done');
    expect(proposalStates.proposal).toBe('current');
  });
});

describe('resolveActiveStep', () => {
  it('forces intake_bant on intake context', () => {
    expect(
      resolveActiveStep({
        funnel: mockFunnel(),
        consultGate: mockGate(),
        intakeSummary: mockIntake(),
        context: 'intake',
      }),
    ).toBe('intake_bant');
  });

  it('selects presales_lead when B2 done but presales missing', () => {
    expect(
      resolveActiveStep({
        funnel: mockFunnel({ presales: null }),
        consultGate: null,
        context: 'lead_detail',
      }),
    ).toBe('presales_lead');
  });

  it('selects consult when presales stage is consult', () => {
    expect(
      resolveActiveStep({
        funnel: mockFunnel({
          presales: {
            presales: { id: 1, stage: 'consult', service_slug: 'x', status: 'active' },
            tasks: {},
            advance: { can_advance_forward: false, block_reason: '', next_stage: 'proposal' },
          },
        }),
        consultGate: null,
        context: 'lead_detail',
      }),
    ).toBe('consult');
  });
});

describe('resolvePrimaryAction', () => {
  it('offers B2 anchor when care incomplete', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel({
        care_pipeline: {
          current_stage_key: 'first_contact',
          current_stage_label: 'Liên hệ',
          all_complete: false,
          contact_ok_reported: false,
          stages: [],
        },
        presales: null,
      }),
      consultGate: null,
      activeStep: 'b2',
      context: 'lead_detail',
    });
    expect(action?.kind).toBe('anchor');
    expect(action?.label).toContain('B2');
  });

  it('offers ensure presales on lead detail', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel({ presales: null }),
      consultGate: null,
      activeStep: 'presales_lead',
      context: 'lead_detail',
    });
    expect(action?.kind).toBe('ensure_presales');
  });

  it('links to lead presales from intake context when presales missing', () => {
    const action = resolvePrimaryAction({
      leadId: 900000002,
      funnel: mockFunnel({ presales: null }),
      consultGate: null,
      activeStep: 'presales_lead',
      context: 'intake',
    });
    expect(action?.kind).toBe('link');
    expect(action?.href).toContain('/crm/leads/900000002');
  });

  it('enables advance when gate ok (parity strong BANT Go)', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: mockGate({ bant_total: 26 }),
      intakeSummary: mockIntake(),
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.kind).toBe('handoff_solution');
    expect(action?.disabled).toBe(false);
    expect(action?.requiresConfirm).toBe(false);
  });

  it('prioritizes handoff over draft continuation when Go completed + gate ok', () => {
    const intakeSummary = mockIntake({ has_draft: true });
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: mockGate({ bant_total: 30 }),
      intakeSummary,
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.kind).toBe('handoff_solution');
    expect(action?.label).toContain('Solution');

    const secondary = resolveSecondaryAction({
      funnel: mockFunnel(),
      consultGate: mockGate({ bant_total: 30 }),
      intakeSummary,
      activeStep: 'intake_bant',
    });
    expect(secondary?.kind).toBe('focus_intake_form');
    expect(secondary?.label).toBe('Tiếp tục khảo sát');
  });

  it('keeps draft continuation primary when gate blocks despite completed intake', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: mockGate({
        ok: false,
        level: 'block',
        messages: ['Hoàn thành task Lead trước khi chuyển Tư vấn'],
      }),
      intakeSummary: mockIntake({ has_draft: true }),
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.kind).toBe('focus_intake_form');
    expect(resolveSecondaryAction({
      funnel: mockFunnel(),
      consultGate: mockGate({ ok: false, level: 'block', messages: ['block'] }),
      intakeSummary: mockIntake({ has_draft: true }),
      activeStep: 'intake_bant',
    })).toBeNull();
  });

  it('requires confirm on nurture gate (parity presales-consult-gate)', () => {
    const gate = mockGate({
      ok: true,
      level: 'warn',
      requires_confirm: true,
      decision: 'nurture',
      bant_total: 20,
      messages: ['Nurture — cân nhắc trước khi chuyển Consult sâu'],
    });
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: gate,
      intakeSummary: mockIntake({ latest_completed: { id: 5, decision: 'nurture', bant_total: 20, completed_at: '' } }),
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.requiresConfirm).toBe(true);
    expect(shouldConfirmPresalesAdvance(gate, '')).toBe(true);
  });

  it('disables advance when lead task gate blocks', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: mockGate({
        ok: false,
        level: 'block',
        messages: ['Hoàn thành task Lead trước khi chuyển Tư vấn'],
      }),
      intakeSummary: mockIntake(),
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.disabled).toBe(true);
    expect(action?.blockReason).toContain('task Lead');
  });

  it('disables advance on no-go without override', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: mockGate({
        ok: false,
        level: 'block',
        requires_override: true,
        decision: 'no_go',
        messages: ['Intake No-Go — không chuyển Consult (Director override + lý do)'],
      }),
      intakeSummary: mockIntake({ latest_completed: { id: 5, decision: 'no_go', bant_total: 10, completed_at: '' } }),
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.disabled).toBe(true);
    expect(action?.requiresOverride).toBe(true);
  });

  it('offers create session when presales started but no intake yet', () => {
    const action = resolvePrimaryAction({
      leadId: 1,
      funnel: mockFunnel(),
      consultGate: null,
      intakeSummary: { has_draft: false },
      activeStep: 'intake_bant',
      context: 'intake',
    });
    expect(action?.kind).toBe('create_intake_session');
  });
});

describe('resolveGateStrip', () => {
  it('returns null outside intake_bant step', () => {
    expect(resolveGateStrip('consult', mockGate())).toBeNull();
  });

  it('maps gate tone for ok/warn/block', () => {
    expect(resolveGateStrip('intake_bant', mockGate())?.tone).toBe('ok');
    expect(resolveGateStrip('intake_bant', mockGate({ level: 'warn', requires_confirm: true }))?.tone).toBe('warn');
    expect(resolveGateStrip('intake_bant', mockGate({ ok: false, level: 'block' }))?.tone).toBe('block');
  });
});

describe('resolveFunnelStepper', () => {
  it('hides stepper when presales on lead disabled', () => {
    const vm = resolveFunnelStepper({
      leadId: 1,
      funnel: mockFunnel({ presales_on_lead_enabled: false }),
      consultGate: null,
      context: 'lead_detail',
    });
    expect(vm.visible).toBe(false);
    expect(vm.steps).toHaveLength(0);
  });

  it('hides stepper for spa operational flow', () => {
    const vm = resolveFunnelStepper({
      leadId: 1,
      funnel: mockFunnel({ lead_flow_kind: 'spa_operational', presales: null }),
      consultGate: null,
      context: 'lead_detail',
    });
    expect(vm.visible).toBe(false);
  });

  it('returns five presales steps when visible', () => {
    const vm = resolveFunnelStepper({
      leadId: 900000002,
      funnel: mockFunnel(),
      consultGate: mockGate(),
      intakeSummary: mockIntake(),
      context: 'intake',
    });
    expect(vm.visible).toBe(true);
    expect(vm.steps).toHaveLength(5);
    expect(vm.steps.find((s) => s.key === 'intake_bant')?.href).toContain('/crm/intake?lead_id=900000002');
    expect(vm.activeStep).toBe('intake_bant');
    expect(vm.gateStrip?.tone).toBe('ok');
    expect(vm.primaryAction?.kind).toBe('handoff_solution');
  });

  it('shows handoff + continue survey when draft and completed Go gate ok', () => {
    const vm = resolveFunnelStepper({
      leadId: 900000002,
      funnel: mockFunnel(),
      consultGate: mockGate(),
      intakeSummary: mockIntake({ has_draft: true }),
      context: 'intake',
    });
    expect(vm.primaryAction?.kind).toBe('handoff_solution');
    expect(vm.secondaryAction?.kind).toBe('focus_intake_form');
  });

  it('shows G4 proposal gate strip on consult step', () => {
    const vm = resolveFunnelStepper({
      leadId: 900000002,
      funnel: mockFunnel({
        presales: {
          presales: { id: 1, stage: 'consult', service_slug: 'lead-gen', status: 'active' },
          tasks: { consult: [{ id: 11, title: 'Consult', is_done: false }] },
          advance: {
            can_advance_forward: false,
            block_reason: 'Hoàn thành task Consult',
            next_stage: 'proposal',
          },
        },
      }),
      consultGate: mockGate(),
      proposalGate: {
        ok: false,
        level: 'block',
        messages: ['Hoàn thành task Consult trước khi chuyển Báo giá', 'Nhập tên kế hoạch MKT sơ bộ.'],
        consult_task_done: false,
        consult_task_total: 1,
        consult_task_done_count: 0,
        marketing_plan: { ok: false, messages: ['Nhập tên kế hoạch MKT sơ bộ.'] },
      },
      intakeSummary: mockIntake(),
      context: 'lead_detail',
    });
    expect(vm.activeStep).toBe('consult');
    expect(vm.gateStrip?.gateKind).toBe('proposal');
    expect(vm.gateStrip?.tone).toBe('block');
    expect(vm.gateStrip?.messages.length).toBeGreaterThanOrEqual(2);
  });
});
