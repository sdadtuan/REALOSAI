import type { LeadFunnelSnapshot } from '@/lib/api';
import type { PresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';

export interface LeadContractFlowSummary {
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  lifecycleId: number | null;
}

export type FunnelStepState = 'done' | 'current' | 'pending' | 'blocked' | 'warn';

export type FunnelStepperScope = 'presales' | 'full_b2b';

export type FunnelStepperContext = 'lead_detail' | 'intake' | 'compact';

export type PresalesFunnelStepKey =
  | 'b2'
  | 'presales_lead'
  | 'intake_bant'
  | 'consult'
  | 'proposal';

export interface ConsultGateState {
  ok: boolean;
  level: string;
  messages: string[];
  requires_confirm: boolean;
  requires_override: boolean;
  bant_total?: number;
  decision?: string;
}

export interface IntakeStepSummary {
  has_draft: boolean;
  latest_completed?: {
    id: number;
    decision: string;
    bant_total: number;
    completed_at: string;
  };
}

export interface PresalesConsultProposalSla {
  tier: 'consult_proposal_48h';
  sla_state: 'na' | 'ok' | 'warning' | 'breach';
  started_at: string | null;
  deadline_at: string | null;
  hours_elapsed: number | null;
  hours_remaining: number | null;
  minutes_remaining: number | null;
  message: string;
  reminder_cta: string;
}

export interface FunnelStepperInput {
  leadId: number;
  funnel: LeadFunnelSnapshot | null;
  consultGate: ConsultGateState | null;
  proposalGate?: ProposalGateState | null;
  consultProposalSla?: PresalesConsultProposalSla | null;
  intakeSummary?: IntakeStepSummary | null;
  solutionCaps?: PresalesSolutionCaps | null;
  contract?: LeadContractFlowSummary | null;
  scope?: FunnelStepperScope;
  context: FunnelStepperContext;
}

export interface FunnelStepDefinition {
  key: PresalesFunnelStepKey;
  label: string;
  shortLabel: string;
  href?: string;
  anchor?: string;
}

export interface FunnelStepViewModel extends FunnelStepDefinition {
  state: FunnelStepState;
  isActive: boolean;
}

export type FunnelPrimaryActionKind =
  | 'none'
  | 'anchor'
  | 'link'
  | 'advance_presales'
  | 'handoff_solution'
  | 'claim_solution'
  | 'release_to_sales'
  | 'ensure_presales'
  | 'create_intake_session'
  | 'focus_intake_form';

export interface FunnelPrimaryAction {
  kind: FunnelPrimaryActionKind;
  label: string;
  disabled: boolean;
  blockReason?: string;
  requiresConfirm?: boolean;
  requiresOverride?: boolean;
  href?: string;
  anchor?: string;
}

export interface FunnelGateStripViewModel {
  tone: 'ok' | 'warn' | 'block';
  title: string;
  messages: string[];
  bantTotal?: number;
  decision?: string;
  requiresConfirm?: boolean;
  requiresOverride?: boolean;
  gateKind?: 'consult' | 'proposal' | 'sla';
  scrollAnchor?: string;
}

export interface ProposalGateState {
  ok: boolean;
  level: 'ok' | 'block';
  messages: string[];
  consult_task_done: boolean;
  consult_task_total: number;
  consult_task_done_count: number;
  marketing_plan: { ok: boolean; messages: string[] };
}

export interface FunnelStepperViewModel {
  visible: boolean;
  scope: FunnelStepperScope;
  context: FunnelStepperContext;
  steps: FunnelStepViewModel[];
  activeStep: PresalesFunnelStepKey | null;
  gateStrip: FunnelGateStripViewModel | null;
  primaryAction: FunnelPrimaryAction | null;
  /** Shown beside primary when both advance and draft continuation apply. */
  secondaryAction?: FunnelPrimaryAction | null;
  inReview: boolean;
}
