export const CONTACT_OK_CARE_STATUS = 'da_lien_he_thanh_cong';

export const PRESALES_STAGES = ['lead', 'consult', 'proposal'] as const;
export type PresalesStage = (typeof PRESALES_STAGES)[number];

export interface CareStageUi {
  key: string;
  label: string;
  hint: string;
  index: number;
  done: boolean;
  current: boolean;
  completed_at: string;
}

export interface CarePipelineState {
  current_stage_key: string;
  current_stage_label: string;
  current_stage_hint: string;
  current_stage_index: number;
  stages_done: Record<string, string>;
  stages: CareStageUi[];
  all_complete: boolean;
  /** True when a B2 care report with status da_lien_he_thanh_cong exists (step 1). */
  contact_ok_reported: boolean;
  /** B2 reports with care_status != da_lien_he_thanh_cong. */
  b2_negative_report_count?: number;
  last_b2_care_status?: string;
  last_b2_care_status_label?: string;
}

export interface PresalesCareGateState {
  complete: boolean;
  stages: Array<{ key: string; label: string; index: number; done: boolean; completed_at: string }>;
  missing_keys: string[];
  missing_labels: string[];
  message: string;
  current_stage_key: string;
}

export interface ReviewQueuePublicState {
  active: boolean;
  reason?: string;
  queued_at?: string;
  assigned_at?: string;
  deadline_hours?: number;
  previous_owner_id?: number | null;
  hours_waiting?: number | null;
  message?: string;
}

export interface LeadFunnelRow {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source?: string;
  channel?: string;
  client_id?: string | null;
  owner_id: number | null;
  meta_json: string;
  care_stage_current: string;
  care_stages_done_json: string;
  is_duplicate: number;
  first_assigned_at?: string;
  updated_at?: string;
}

import type { LeadFlowKind } from './lead-flow-kind.util';

export interface LeadFunnelSnapshot {
  lead_id: number;
  lead_flow_kind: LeadFlowKind;
  care_pipeline: CarePipelineState;
  presales_care_gate: PresalesCareGateState;
  review_queue: ReviewQueuePublicState;
  presales_on_lead_enabled: boolean;
  presales: PresalesSnapshot | null;
}

export interface PresalesTaskRow {
  id: number;
  presales_id: number;
  stage: string;
  step_index: number;
  title: string;
  description: string;
  form_fields: unknown[];
  form_data: Record<string, unknown>;
  ai_prompt_key: string;
  ai_output: string;
  is_done: boolean;
  done_at: string;
  notes: string;
}

export interface PresalesL2DocRow {
  key: string;
  label: string;
  checked: boolean;
}

export interface PresalesL2DocsView {
  service_slug: string;
  items: PresalesL2DocRow[];
  total: number;
  done: number;
  complete: boolean;
  missing_labels: string[];
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

export interface PresalesConsultSlaSummary {
  active_consult: number;
  sla_ok: number;
  sla_warning: number;
  sla_breach: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
}

export interface PresalesFunnelMetricsResult {
  go_to_consult_median_hours: number | null;
  go_to_consult_p90_hours: number | null;
  go_to_consult_sample: number;
  consult_to_proposal_7d_pct: number;
  consult_to_proposal_7d_num: number;
  consult_to_proposal_7d_denom: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
  consult_form_completion_pct: number;
  consult_task_done_rate: number;
  consult_tasks_total: number;
  consult_tasks_done: number;
}

export interface PresalesFunnelMetricLabels {
  consult_to_proposal_7d: string;
  consult_to_proposal_48h: string;
}

export interface PresalesFunnelMetricsResponse {
  ok: true;
  period_start: string | null;
  period_end: string | null;
  am_id: number | null;
  metrics: PresalesFunnelMetricsResult;
  labels: PresalesFunnelMetricLabels;
}

export type PresalesHandoffStatus = '' | 'pending' | 'with_solution' | 'released';

export interface PresalesHandoffView {
  status: PresalesHandoffStatus;
  handed_off_at: string;
  handed_off_by_staff_id: number | null;
  solution_owner_staff_id: number | null;
  solution_owner_name: string;
  solution_claimed_at: string;
  solution_released_at: string;
}

export interface PresalesRow {
  id: number;
  lead_id: number;
  service_slug: string;
  stage: PresalesStage;
  status: string;
  assigned_am: number | null;
  lifecycle_id: number | null;
  stage_entered_at: string;
  consult_entered_at: string;
  proposal_entered_at: string;
  notes: string;
  draft_marketing_plan_id: number | null;
  l2_docs_json: Record<string, boolean>;
  handoff_status: PresalesHandoffStatus;
  handed_off_at: string;
  handed_off_by_staff_id: number | null;
  solution_owner_staff_id: number | null;
  solution_claimed_at: string;
  solution_released_at: string;
}

export interface SolutionQueueRow {
  lead_id: number;
  full_name: string;
  phone: string;
  service_slug: string;
  presales_stage: PresalesStage;
  handoff_status: PresalesHandoffStatus;
  handed_off_at: string;
  solution_owner_staff_id: number | null;
  solution_owner_name: string;
  owner_id: number | null;
  owner_name: string;
}

export interface PresalesSnapshot {
  presales: PresalesRow;
  handoff: PresalesHandoffView;
  l2_docs: PresalesL2DocsView;
  consult_proposal_sla: PresalesConsultProposalSla;
  tasks: Record<string, PresalesTaskRow[]>;
  progress: Record<string, { total: number; done: number }>;
  advance: {
    current_stage: string;
    next_stage: string | null;
    can_advance_forward: boolean;
    block_reason: string;
    current_complete: boolean;
    current_done: number;
    current_total: number;
    status: string;
  };
}

export interface CompleteCareStageBody {
  stage: string;
  note: string;
  care_status?: string;
  care_contact_type?: string;
  content?: string;
}

export interface ReleaseReviewQueueBody {
  mode: 'auto' | 'manual';
  owner_id?: number;
  note?: string;
  /** B2B manual reassign split choice when PTT_B2B_PROJECT_OS=1. */
  split?: 'keep_first_touch' | 'reset_closer' | 'no_split';
}

export interface EnsurePresalesBody {
  service_slug: string;
}

export interface AdvancePresalesBody {
  to_stage?: PresalesStage;
  confirm?: boolean;
  override_reason?: string;
}

export interface HandoffSolutionBody {
  confirm?: boolean;
  override_reason?: string;
}

export interface PatchPresalesTaskBody {
  is_done?: boolean;
  notes?: string;
  form_data?: Record<string, unknown>;
}

export interface PatchMarketingPlanBody {
  name?: string;
  north_star?: string;
  objectives?: string;
  strategy_framework?: Record<string, string>;
  target_market_prof?: Record<string, string>;
}

export interface PatchPresalesL2DocsBody {
  docs: Record<string, boolean>;
}

export interface PresalesConsultSlaReminderBody {
  message?: string;
}

export interface ConsultPrefillBody {
  overwrite?: boolean;
}

export interface PresalesAiAssistBody {
  form_context?: Record<string, unknown>;
}

export interface UpgradePresalesWorkflowBody {
  stages?: PresalesStage[];
  dry_run?: boolean;
  prefill_consult?: boolean;
}

export interface BatchUpgradePresalesWorkflowBody {
  dry_run?: boolean;
  prefill_consult?: boolean;
  stages?: PresalesStage[];
  lead_ids?: number[];
  limit?: number;
}
