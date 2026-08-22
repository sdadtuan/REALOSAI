export type LeadMeetingPrepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_entity_choice'
  | 'ready'
  | 'failed'
  | 'skipped'
  | 'cancelled';

export type LeadMeetingPrepStage =
  | 'm1_first_strike'
  | 'm2_qualify_win'
  | 'm3_pre_close'
  | 'm4_learn';

export type WinOutcomeTier = 'CB' | 'TC' | 'CS';

export interface WinOutcomeJson {
  outcome: 'won' | 'lost';
  deal_value_vnd: number | null;
  closed_tier: WinOutcomeTier | null;
  objection_faced: string | null;
  am_feedback: string | null;
  sci_helpful: boolean | null;
  submitted_at: string;
  submitted_by: string;
  prep_stage_at_close: string | null;
  learn_processed_at?: string | null;
  recommended_dv_codes?: string[];
  industry_slug?: string | null;
}

export interface LeadPrepContextRow {
  lead_id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  source: string | null;
  channel: string | null;
  client_id: string | null;
  is_duplicate: boolean | null;
  meta_json: Record<string, unknown>;
}

export interface LeadMeetingPrepInput {
  lead_id: number;
  full_name: string;
  phone: string;
  email: string;
  company_name: string;
  industry: string;
  marketing_budget: string;
  problem: string;
  website_url?: string;
  social_urls?: string;
  client_id?: string | null;
  channel?: string | null;
  source?: string | null;
}

export interface LeadMeetingPrepRow {
  id: number;
  lead_id: number;
  status: LeadMeetingPrepStatus;
  skip_reason: string | null;
  input_snapshot_json: Record<string, unknown>;
  collect_json: Record<string, unknown>;
  entity_candidates_json: unknown[];
  selected_entity_id: string | null;
  result_json: Record<string, unknown>;
  error_message: string | null;
  prep_version: number;
  synth_version: number;
  tavily_credits_used: number;
  apify_runs: number;
  prep_stage: LeadMeetingPrepStage;
  close_readiness_score: number | null;
  win_outcome_json: Record<string, unknown>;
  ai_agent_run_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueLeadMeetingPrepInput {
  leadId: number;
  clientId?: string | null;
  correlationId?: string | null;
  prepStage?: LeadMeetingPrepStage;
  mode?: 'full' | 'resume_entity' | 'strategize_arm' | 'learn';
  selectedEntityId?: string | null;
  force?: boolean;
  terminalStatus?: 'chot' | 'lost';
}

export interface RunLeadMeetingPrepBody {
  force?: boolean;
  website_url?: string;
  social_urls?: string;
  prep_stage?: LeadMeetingPrepStage;
  mode?: 'full' | 'strategize_arm';
}

export interface ApplyOfferLadderResponse {
  ok: true;
  lead_id: number;
  proposal_id: number;
  href: string;
  tiers_applied: Array<'CB' | 'TC' | 'CS'>;
}

export interface SelectEntityBody {
  entity_id: string;
}

export interface LeadMeetingPrepFeedbackBody {
  helpful: boolean;
  notes?: string;
  service_dv_code?: string;
}

/** S-LMP-6 — post-close debrief (3 câu). */
export interface LeadMeetingPrepDebriefBody {
  closed_tier?: WinOutcomeTier;
  objection_faced?: string;
  am_feedback?: string;
  deal_value_vnd?: number;
  sci_helpful?: boolean;
}

/** Post-call debrief ngắn sau log activity call (non-terminal). */
export interface LeadMeetingPrepCallDebriefBody {
  activity_id?: number;
  objection_faced?: string;
  am_feedback?: string;
  sci_helpful?: boolean;
}
