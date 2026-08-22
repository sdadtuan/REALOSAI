export type LeadMeetingPrepStatus =
  | 'pending'
  | 'running'
  | 'awaiting_entity_choice'
  | 'ready'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'none';

export type PrepStage = 'm1_first_strike' | 'm2_qualify_win' | 'm3_pre_close' | 'm4_learn';

export type WinOutcomeTier = 'CB' | 'TC' | 'CS';

export type WinOutcomeJson = {
  outcome: 'won' | 'lost';
  deal_value_vnd: number | null;
  closed_tier: WinOutcomeTier | null;
  objection_faced: string | null;
  am_feedback: string | null;
  sci_helpful: boolean | null;
  submitted_at: string;
  submitted_by: string;
  prep_stage_at_close: string | null;
};

export type EntityCandidate = {
  id: string;
  url: string;
  label: string;
  phone?: string | null;
  region_hint?: string | null;
  confidence?: string;
};

export type PrepFact =
  | { label: string; value: string; type: 'sourced'; source: string }
  | { label: string; value: string; type: 'inferred' };

export type RecommendedService = {
  dv_code: string;
  name_vi: string;
  department: string;
  reason: string;
  priority: number;
};

export type OfferLadderItem = {
  tier: 'CB' | 'TC' | 'CS';
  dv_code: string;
  sku_code: string;
  label_vi: string;
  anchor_role: 'entry' | 'recommended' | 'premium';
  headline_vi: string;
  price_hint_vnd: number | null;
  reason_vi: string;
};

export type TalkTrack = {
  framework: 'SPIN' | 'Challenger';
  total_minutes: number;
  phases: Array<{ phase_vi: string; script_vi: string; duration_min: number }>;
};

export type CloseIntelligence = {
  close_readiness_score: number;
  urgency_signals: Array<{ signal: string; evidence: string; type: 'sourced' | 'inferred' }>;
  pain_roi_estimate: {
    pain_vnd_low: number | null;
    pain_vnd_high: number | null;
    basis: string;
    type: 'sourced' | 'inferred';
  };
  competitive_angle: {
    vs_status_quo: string;
    vs_generic_agency: string;
    ptt_proof: string[];
    playbook_slug: string | null;
  };
  offer_ladder: OfferLadderItem[];
  talk_track: TalkTrack;
  objection_playbook: Array<{ objection_vi: string; rebuttal_vi: string; proof_source?: string }>;
  stakeholder_hints: Array<{ role_vi: string; likely_concern_vi: string; question_vi: string }>;
  red_flags: Array<{ flag_vi: string; severity: 'warn' | 'block'; mitigation_vi: string }>;
  deal_room_payload?: {
    opening_narrative_vi: string;
    slide_bullets_vi: string[];
    recommended_close_ask_vi: string;
    primary_dv_code: string;
    recommended_tier: 'CB' | 'TC' | 'CS';
  };
};

export type ReadinessBreakdownFactor = {
  label_vi: string;
  points: number;
  applied: boolean;
};

export type LeadMeetingPrepResult = {
  company_profile: { summary: string; facts: PrepFact[] };
  contact_profile: { found: false; summary: string; facts: [] };
  website?: { url: string; confidence: string; note?: string | null };
  social_channels?: Array<Record<string, unknown>>;
  recommended_services: RecommendedService[];
  consulting_script: {
    opening: string;
    pain_points: string[];
    key_questions: string[];
    objection_handling: Array<{ objection: string; response: string }>;
  };
  close_intelligence?: CloseIntelligence;
  meta: {
    researched_at?: string;
    sources_count?: number;
    model?: string;
    prompt_version?: string;
    prep_stage?: PrepStage | string;
    tavily_credits_used?: number;
    apify_runs?: number;
    partial_collect?: boolean;
    close_readiness_score?: number;
    readiness_breakdown?: ReadinessBreakdownFactor[];
  };
};

export type LeadMeetingPrepResponse = {
  ok: boolean;
  lead_id: number;
  status: LeadMeetingPrepStatus;
  status_label_vi: string;
  progress: {
    step: string;
    steps_completed: string[];
    message_vi: string;
  };
  prep_stage: string;
  close_readiness_score: number | null;
  readiness_breakdown?: ReadinessBreakdownFactor[];
  entity_candidates: EntityCandidate[] | null;
  result: LeadMeetingPrepResult | null;
  error: string | null;
  prep_version: number;
  updated_at: string | null;
  win_outcome?: WinOutcomeJson | null;
  debrief_pending?: boolean;
};

export type LeadMeetingPrepFeedbackBody = {
  helpful: boolean;
  notes?: string;
  service_dv_code?: string;
};
