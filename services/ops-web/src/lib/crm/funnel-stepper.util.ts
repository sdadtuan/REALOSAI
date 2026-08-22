import type { LeadFunnelSnapshot } from '@/lib/api';
import { showPresalesForFlow } from '@/lib/crm/lead-flow-kind';
import type { PresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';
import type {
  ConsultGateState,
  FunnelGateStripViewModel,
  FunnelPrimaryAction,
  FunnelStepDefinition,
  FunnelStepperContext,
  FunnelStepperInput,
  FunnelStepperScope,
  FunnelStepperViewModel,
  FunnelStepState,
  IntakeStepSummary,
  PresalesConsultProposalSla,
  PresalesFunnelStepKey,
  ProposalGateState,
} from '@/lib/crm/funnel-stepper.types';

export const PRESALES_FUNNEL_STEPS: FunnelStepDefinition[] = [
  { key: 'b2', label: 'B2 Liên hệ', shortLabel: 'B2', anchor: '#funnel-b2' },
  { key: 'presales_lead', label: 'Pre-sales Lead', shortLabel: 'Lead', anchor: '#funnel-presales' },
  { key: 'intake_bant', label: 'Khảo sát BANT', shortLabel: 'Intake' },
  { key: 'consult', label: 'Tư vấn', shortLabel: 'Tư vấn', anchor: '#funnel-presales' },
  { key: 'proposal', label: 'Báo giá', shortLabel: 'Báo giá', anchor: '#funnel-presales' },
];

const PRESALES_STAGE_ORDER = ['lead', 'consult', 'proposal'] as const;

export function presalesStageIndex(stage: string | undefined): number {
  const idx = PRESALES_STAGE_ORDER.indexOf(stage as (typeof PRESALES_STAGE_ORDER)[number]);
  return idx >= 0 ? idx : -1;
}

function intakeHref(leadId: number, serviceSlug?: string | null): string {
  const slug = String(serviceSlug ?? '').trim();
  return `/crm/intake?lead_id=${leadId}${slug ? `&service_slug=${encodeURIComponent(slug)}` : ''}`;
}

function inReview(funnel: LeadFunnelSnapshot | null): boolean {
  return Boolean(funnel?.review_queue.active);
}

function b2Done(funnel: LeadFunnelSnapshot | null): boolean {
  return Boolean(funnel?.care_pipeline.all_complete);
}

function presalesStarted(funnel: LeadFunnelSnapshot | null): boolean {
  return Boolean(funnel?.presales?.presales);
}

function presalesStage(funnel: LeadFunnelSnapshot | null): string {
  return String(funnel?.presales?.presales.stage ?? '');
}

function hasCompletedIntake(intakeSummary?: IntakeStepSummary | null): boolean {
  return Boolean(intakeSummary?.latest_completed);
}

function intakeGateReadyState(
  consultGate: ConsultGateState | null,
  intakeSummary?: IntakeStepSummary | null,
): FunnelStepState | null {
  if (!hasCompletedIntake(intakeSummary)) return null;
  if (!consultGate) return 'current';
  if (!consultGate.ok || consultGate.level === 'block') return 'current';
  if (consultGate.level === 'warn' || consultGate.requires_confirm) return 'warn';
  if (consultGate.ok && consultGate.level === 'ok') return 'done';
  return 'current';
}

function handoffStatus(funnel: LeadFunnelSnapshot | null): string {
  return String(funnel?.presales?.handoff?.status ?? '');
}

function resolveHandoffSolutionAction(consultGate: ConsultGateState | null): FunnelPrimaryAction {
  if (!consultGate) {
    return {
      kind: 'none',
      label: 'Giao Solution/MKT →',
      disabled: true,
      blockReason: 'Đang tải gate…',
    };
  }

  if (!consultGate.ok || consultGate.level === 'block') {
    return {
      kind: 'handoff_solution',
      label: 'Giao Solution/MKT →',
      disabled: true,
      blockReason: consultGate.messages[0] ?? 'Chưa đủ điều kiện giao Solution',
      requiresOverride: consultGate.requires_override,
    };
  }

  const requiresConfirm = consultGate.requires_confirm || consultGate.level === 'warn';
  return {
    kind: 'handoff_solution',
    label: requiresConfirm ? 'Giao Solution/MKT (xác nhận) →' : 'Giao Solution/MKT →',
    disabled: false,
    requiresConfirm,
  };
}

function resolveIntakeBantState(
  funnel: LeadFunnelSnapshot | null,
  consultGate: ConsultGateState | null,
  intakeSummary?: IntakeStepSummary | null,
): FunnelStepState {
  if (inReview(funnel)) return 'blocked';
  if (!b2Done(funnel) || !presalesStarted(funnel)) return 'pending';

  const stageIdx = presalesStageIndex(presalesStage(funnel));
  if (stageIdx >= 1) return 'done';

  if (intakeSummary?.has_draft) {
    const ready = intakeGateReadyState(consultGate, intakeSummary);
    if (ready === 'done' || ready === 'warn') return ready;
    return 'current';
  }

  const ready = intakeGateReadyState(consultGate, intakeSummary);
  if (ready) return ready;

  return 'pending';
}

export function resolvePresalesStepStates(input: {
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  intakeSummary?: IntakeStepSummary | null;
}): Record<PresalesFunnelStepKey, FunnelStepState> {
  const { funnel, consultGate, intakeSummary } = input;

  if (inReview(funnel)) {
    return {
      b2: 'blocked',
      presales_lead: 'blocked',
      intake_bant: 'blocked',
      consult: 'blocked',
      proposal: 'blocked',
    };
  }

  const b2Complete = b2Done(funnel);
  const started = presalesStarted(funnel);
  const stageIdx = presalesStageIndex(presalesStage(funnel));

  const b2State: FunnelStepState = b2Complete ? 'done' : 'current';

  let presalesLeadState: FunnelStepState = 'pending';
  if (!b2Complete) {
    presalesLeadState = 'pending';
  } else if (!started) {
    presalesLeadState = 'current';
  } else if (stageIdx >= 1) {
    presalesLeadState = 'done';
  } else {
    presalesLeadState = 'pending';
  }

  const intakeState = resolveIntakeBantState(funnel, consultGate, intakeSummary);

  let consultState: FunnelStepState = 'pending';
  if (stageIdx >= 2) {
    consultState = 'done';
  } else if (stageIdx === 1) {
    consultState = 'current';
  }

  let proposalState: FunnelStepState = 'pending';
  if (stageIdx >= 2) {
    proposalState = 'current';
  }

  return {
    b2: b2State,
    presales_lead: presalesLeadState,
    intake_bant: intakeState,
    consult: consultState,
    proposal: proposalState,
  };
}

export function resolveActiveStep(input: {
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  intakeSummary?: IntakeStepSummary | null;
  context: FunnelStepperContext;
}): PresalesFunnelStepKey | null {
  const { funnel, context, consultGate, intakeSummary } = input;

  if (!funnel?.presales_on_lead_enabled) return null;
  if (!showPresalesForFlow(funnel.lead_flow_kind)) return null;

  if (inReview(funnel)) return 'intake_bant';

  if (context === 'intake') {
    if (!b2Done(funnel)) return 'b2';
    if (!presalesStarted(funnel)) return 'presales_lead';
    return 'intake_bant';
  }

  if (!b2Done(funnel)) return 'b2';
  if (!presalesStarted(funnel)) return 'presales_lead';

  const stageIdx = presalesStageIndex(presalesStage(funnel));
  if (stageIdx === 0) {
    if (!hasCompletedIntake(intakeSummary) || intakeSummary?.has_draft) return 'intake_bant';
    if (consultGate?.ok && consultGate.level === 'ok') return 'intake_bant';
    if (consultGate && (!consultGate.ok || consultGate.level === 'block')) return 'intake_bant';
    if (consultGate?.requires_confirm) return 'intake_bant';
    return 'intake_bant';
  }
  if (stageIdx === 1) return 'consult';
  if (stageIdx >= 2) return 'proposal';

  return 'intake_bant';
}

export function resolveGateStrip(
  activeStep: PresalesFunnelStepKey | null,
  consultGate: ConsultGateState | null,
  proposalGate?: ProposalGateState | null,
  consultProposalSla?: PresalesConsultProposalSla | null,
): FunnelGateStripViewModel | null {
  if (
    activeStep === 'consult' &&
    consultProposalSla &&
    (consultProposalSla.sla_state === 'warning' || consultProposalSla.sla_state === 'breach')
  ) {
    return {
      tone: consultProposalSla.sla_state === 'breach' ? 'block' : 'warn',
      gateKind: 'sla',
      title:
        consultProposalSla.sla_state === 'breach'
          ? 'SLA 48h Consult → Báo giá — Quá hạn'
          : 'SLA 48h Consult → Báo giá — Sắp hết hạn',
      messages: [consultProposalSla.message],
      scrollAnchor: '#funnel-presales',
    };
  }

  if (activeStep === 'consult' && proposalGate) {
    const tone = proposalGate.ok && proposalGate.level === 'ok' ? 'ok' : 'block';
    return {
      tone,
      gateKind: 'proposal',
      title:
        tone === 'ok'
          ? 'Sẵn sàng chuyển Báo giá'
          : 'Chưa đủ điều kiện Báo giá',
      messages: proposalGate.messages,
      scrollAnchor: '#funnel-presales-r5',
    };
  }

  if (activeStep !== 'intake_bant' || !consultGate) return null;

  const tone =
    consultGate.level === 'warn'
      ? 'warn'
      : consultGate.level === 'block' || !consultGate.ok
        ? 'block'
        : 'ok';

  const title =
    tone === 'ok'
      ? 'Sẵn sàng chuyển Tư vấn "Consult"'
      : tone === 'warn'
        ? 'Cần xem xét trước Tư vấn "Consult"'
        : 'Chưa đủ điều kiện Tư vấn "Consult"';

  return {
    tone,
    gateKind: 'consult',
    title,
    messages: consultGate.messages,
    bantTotal: consultGate.bant_total,
    decision: consultGate.decision,
    requiresConfirm: consultGate.requires_confirm,
    requiresOverride: consultGate.requires_override,
  };
}

export function resolvePrimaryAction(input: {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  proposalGate?: ProposalGateState | null;
  intakeSummary?: IntakeStepSummary | null;
  solutionCaps?: PresalesSolutionCaps | null;
  activeStep: PresalesFunnelStepKey | null;
  context: FunnelStepperContext;
}): FunnelPrimaryAction | null {
  const { leadId, funnel, consultGate, proposalGate, intakeSummary, solutionCaps, activeStep, context } =
    input;
  if (!activeStep || inReview(funnel)) {
    return { kind: 'none', label: '', disabled: true };
  }

  const serviceSlug = funnel?.presales?.presales.service_slug;
  const intakeLink = intakeHref(leadId, serviceSlug);

  if (activeStep === 'b2') {
    if (b2Done(funnel)) return null;
    return {
      kind: 'anchor',
      label: 'Hoàn thành B2 →',
      disabled: false,
      anchor: '#funnel-b2',
    };
  }

  if (activeStep === 'presales_lead') {
    if (presalesStarted(funnel)) return null;
    if (context === 'intake') {
      return {
        kind: 'link',
        label: 'Bắt đầu pre-sales trên Lead →',
        disabled: false,
        href: `/crm/leads/${leadId}#funnel-presales`,
      };
    }
    return {
      kind: 'ensure_presales',
      label: 'Bắt đầu pre-sales',
      disabled: false,
      anchor: '#funnel-presales',
    };
  }

  if (activeStep === 'intake_bant') {
    const stageIdx = presalesStageIndex(presalesStage(funnel));
    if (stageIdx >= 1) return null;

    if (!hasCompletedIntake(intakeSummary) && !intakeSummary?.has_draft) {
      if (context === 'intake') {
        return {
          kind: 'create_intake_session',
          label: '+ Tạo phiên Intake',
          disabled: false,
        };
      }
      return {
        kind: 'link',
        label: '+ Tạo phiên Intake →',
        disabled: false,
        href: intakeLink,
      };
    }

    if (intakeSummary?.has_draft) {
      const continueDraft: FunnelPrimaryAction = {
        kind: 'focus_intake_form',
        label: 'Tiếp tục khảo sát',
        disabled: false,
      };
      if (hasCompletedIntake(intakeSummary)) {
        const advance = resolveHandoffSolutionAction(consultGate);
        if (
          advance.kind === 'handoff_solution' &&
          !advance.disabled &&
          (solutionCaps?.canHandoff ?? true)
        ) {
          return advance;
        }
      }
      return continueDraft;
    }

    if (hasCompletedIntake(intakeSummary)) {
      const handoff = resolveHandoffSolutionAction(consultGate);
      if (!(solutionCaps?.canHandoff ?? true)) {
        return {
          kind: 'none',
          label: 'Giao Solution/MKT →',
          disabled: true,
          blockReason: 'Chỉ AM Sales mới giao Solution/MKT',
        };
      }
      return handoff;
    }

    return null;
  }

  if (activeStep === 'consult') {
    const status = handoffStatus(funnel);
    if (status === 'pending' && solutionCaps?.canClaim) {
      return {
        kind: 'claim_solution',
        label: 'Nhận case',
        disabled: false,
      };
    }
    if (status === 'pending') {
      return {
        kind: 'link',
        label: solutionCaps?.canView ? 'Solution queue →' : 'Theo dõi Solution',
        disabled: false,
        href: '/crm/solution/queue',
      };
    }
    if (status === 'with_solution' && proposalGate?.ok && solutionCaps?.canRelease) {
      return {
        kind: 'release_to_sales',
        label: 'Trả Sales — Báo giá →',
        disabled: false,
      };
    }
    if (status === 'with_solution' && !solutionCaps?.canEditConsult) {
      return {
        kind: 'anchor',
        label: 'Theo dõi Solution (read-only)',
        disabled: false,
        anchor: '#funnel-presales',
      };
    }
    const advance = funnel?.presales?.advance;
    if (status === '' && advance?.next_stage === 'proposal') {
      if (advance.can_advance_forward) {
        return {
          kind: 'advance_presales',
          label: 'Chuyển → Báo giá',
          disabled: false,
        };
      }
      if (shouldConfirmPresalesAdvance(null, advance.block_reason)) {
        return {
          kind: 'advance_presales',
          label: 'Chuyển → Báo giá (xác nhận)',
          disabled: false,
          requiresConfirm: true,
          blockReason: advance.block_reason || undefined,
        };
      }
    }
    return {
      kind: 'anchor',
      label: status === 'with_solution' ? 'Mở workspace Consult' : 'Mở task Consult',
      disabled: false,
      anchor: '#funnel-presales',
    };
  }

  if (activeStep === 'proposal') {
    const advance = funnel?.presales?.advance;
    if (advance?.next_stage && advance.can_advance_forward) {
      return {
        kind: 'advance_presales',
        label: `Chuyển → ${advance.next_stage}`,
        disabled: false,
      };
    }
    return {
      kind: 'anchor',
      label: 'Mở Báo giá',
      disabled: false,
      anchor: '#funnel-presales',
    };
  }

  return null;
}

export function resolveSecondaryAction(input: {
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  intakeSummary?: IntakeStepSummary | null;
  activeStep: PresalesFunnelStepKey | null;
}): FunnelPrimaryAction | null {
  const { funnel, consultGate, intakeSummary, activeStep } = input;
  if (!activeStep || activeStep !== 'intake_bant' || inReview(funnel)) return null;

  const stageIdx = presalesStageIndex(presalesStage(funnel));
  if (stageIdx >= 1) return null;
  if (!intakeSummary?.has_draft || !hasCompletedIntake(intakeSummary)) return null;

  const advance = resolveHandoffSolutionAction(consultGate);
  if (advance.kind !== 'handoff_solution' || advance.disabled) return null;

  return {
    kind: 'focus_intake_form',
    label: 'Tiếp tục khảo sát',
    disabled: false,
  };
}

function applyActiveStepHighlight(
  states: Record<PresalesFunnelStepKey, FunnelStepState>,
  activeStep: PresalesFunnelStepKey | null,
): Record<PresalesFunnelStepKey, FunnelStepState> {
  if (!activeStep) return states;
  const next = { ...states };
  for (const key of PRESALES_FUNNEL_STEPS) {
    if (key.key === activeStep) {
      if (next[key.key] !== 'blocked' && next[key.key] !== 'warn') {
        next[key.key] = 'current';
      }
      continue;
    }
    if (next[key.key] === 'current') {
      next[key.key] = 'pending';
    }
  }
  return next;
}

export function resolveFunnelStepper(input: FunnelStepperInput): FunnelStepperViewModel {
  const scope: FunnelStepperScope = input.scope ?? 'presales';
  const funnel = input.funnel;
  const visible = Boolean(
    funnel?.presales_on_lead_enabled && showPresalesForFlow(funnel.lead_flow_kind ?? 'b2b_prospect'),
  );

  if (!visible) {
    return {
      visible: false,
      scope,
      context: input.context,
      steps: [],
      activeStep: null,
      gateStrip: null,
      primaryAction: null,
      inReview: inReview(funnel),
    };
  }

  const rawStates = resolvePresalesStepStates({
    funnel,
    consultGate: input.consultGate,
    intakeSummary: input.intakeSummary,
  });
  const activeStep = resolveActiveStep({
    funnel,
    consultGate: input.consultGate,
    intakeSummary: input.intakeSummary,
    context: input.context,
  });
  const states = applyActiveStepHighlight(rawStates, activeStep);

  const serviceSlug = funnel?.presales?.presales.service_slug;
  const intakeLink = intakeHref(input.leadId, serviceSlug);

  const steps = PRESALES_FUNNEL_STEPS.map((def) => {
    const href = def.key === 'intake_bant' ? intakeLink : def.href;
    return {
      ...def,
      href,
      state: states[def.key],
      isActive: def.key === activeStep,
    };
  });

  return {
    visible: true,
    scope,
    context: input.context,
    steps,
    activeStep,
    gateStrip: resolveGateStrip(
      activeStep,
      input.consultGate,
      input.proposalGate,
      input.consultProposalSla,
    ),
    primaryAction: resolvePrimaryAction({
      leadId: input.leadId,
      funnel,
      consultGate: input.consultGate,
      proposalGate: input.proposalGate,
      intakeSummary: input.intakeSummary,
      solutionCaps: input.solutionCaps,
      activeStep,
      context: input.context,
    }),
    secondaryAction: resolveSecondaryAction({
      funnel,
      consultGate: input.consultGate,
      intakeSummary: input.intakeSummary,
      activeStep,
    }),
    inReview: inReview(funnel),
  };
}

/** Whether advance CTA should proceed (mirrors LeadFunnelPanel confirm rules). */
export function shouldConfirmPresalesAdvance(
  consultGate: ConsultGateState | null,
  blockReason = '',
): boolean {
  if (consultGate?.requires_confirm) return true;
  if (consultGate?.level === 'warn') return true;
  return (
    blockReason.includes('Nurture') || blockReason.includes('BANT') || blockReason.includes('cân nhắc')
  );
}
