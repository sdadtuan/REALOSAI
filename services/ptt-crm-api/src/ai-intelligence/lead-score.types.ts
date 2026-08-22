export type ScoreBand = 'hot' | 'warm' | 'cold';

export interface LeadScoreFactor {
  key: string;
  label: string;
  delta: number;
  sign: '+' | '-';
}

export interface ScoreReason {
  feature: string;
  direction: '+' | '-';
  weight: number;
}

export interface LeadScoreExplainability {
  factors: LeadScoreFactor[];
  flags: string[];
  score_band: ScoreBand;
}

export interface LeadScoreContext {
  leadId: number;
  clientId: string | null;
  channel: string | null;
  source: string | null;
  campaignId: string | null;
  externalLeadId: string | null;
  status: string | null;
  isDuplicate: boolean;
  receivedAt: Date;
  createdAt: Date;
  firstContactAt: Date | null;
  timelineEventCount: number;
  meta: Record<string, unknown>;
  estimatedDealValueVnd: number | null;
  campaignName?: string | null;
  cplVnd?: number | null;
  targetCplVnd?: number | null;
  cplOverTarget?: boolean;
}

export interface LeadScoreEngineResult {
  score: number;
  confidence: number;
  explainability: LeadScoreExplainability;
  top_features: ScoreReason[];
  features: Record<string, unknown>;
}

export interface AiScoreRecord {
  id: string;
  client_id: string | null;
  entity_type: string;
  entity_id: string;
  score_type: string;
  score_value: number;
  confidence: number | null;
  features_json: Record<string, unknown>;
  explainability_json: LeadScoreExplainability;
  model_name: string | null;
  model_version: string;
  agent_run_id: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  override_reason: string | null;
  calculated_at: string;
  created_at: string;
}

export interface ScoreLeadRequest {
  leadId: number;
  force?: boolean;
  actorId?: string | null;
  correlationId?: string | null;
  clientId?: string | null;
}

export interface ScoreLeadResponseData {
  score_id: string;
  lead_id: number;
  score: number;
  confidence: number;
  score_band: ScoreBand;
  explainability: LeadScoreExplainability;
  top_features: ScoreReason[];
  model_name: string;
  model_version: string;
  agent_run_id: string;
  calculated_at: string;
  idempotent_replay: boolean;
}

export type ScoreLeadResponse = {
  data: ScoreLeadResponseData;
  meta: { request_id: string };
  errors: unknown[];
};

export type AiScoresListResponse = {
  data: {
    entity_type: string;
    entity_id: string;
    scores: AiScoreRecord[];
    latest: AiScoreRecord | null;
  };
  meta: { request_id: string };
  errors: unknown[];
};

export type AiScoresBatchResponse = {
  data: {
    entity_type: string;
    scores_by_entity_id: Record<string, AiScoreRecord>;
  };
  meta: { request_id: string };
  errors: unknown[];
};

export const LEAD_SCORE_MODEL = 'rules-v1';
export const LEAD_SCORE_MODEL_V2 = 'rules-v2';
export const LEAD_SCORE_OVERRIDE_MODEL = 'manual_override';
export const LEAD_SCORE_MODEL_VERSION = 'lead-v1';
export const LEAD_SCORE_MODEL_VERSION_V2 = 'lead-v2';
export const LEAD_SCORE_IDEMPOTENCY_MINUTES = 5;

export interface ScoreFeedbackAggregate {
  override_count: number;
  avg_override_score: number | null;
  outcome_chot: number;
  outcome_lost: number;
  outcome_stalled: number;
}

export interface OverrideLeadScoreRequest {
  leadId: number;
  score: number;
  overrideReason: string;
  actorId?: string | null;
  actorEmail?: string | null;
  correlationId?: string | null;
  clientId?: string | null;
}

export type OverrideLeadScoreResponse = ScoreLeadResponse;
