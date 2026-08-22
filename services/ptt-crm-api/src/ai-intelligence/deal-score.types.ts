import { LeadScoreExplainability, LeadScoreFactor, ScoreBand } from './lead-score.types';

export const DEAL_SCORE_MODEL = 'deal-rules-v1';
export const DEAL_SCORE_MODEL_VERSION = '2026-07-26';

export interface DealScoreContext {
  dealId: number;
  clientId: string | null;
  title: string;
  pipelineStage: string;
  isTerminal: boolean;
  dealValueVnd: number;
  stageEnteredAt: Date;
  updatedAt: Date;
  lastActivityAt: Date | null;
  activityCount7d: number;
  status: string;
}

export interface DealScoreEngineResult {
  score: number;
  confidence: number;
  explainability: LeadScoreExplainability;
  features: Record<string, unknown>;
  stalledDays: number;
  isStalled: boolean;
}

export interface ScoreDealRequest {
  dealId: number;
  force?: boolean;
  actorId?: string | null;
  correlationId?: string;
  clientId?: string | null;
}

export interface ScoreDealResponse {
  data: {
    deal_id: number;
    score: number;
    confidence: number;
    score_band: ScoreBand;
    explainability: LeadScoreExplainability;
    cached: boolean;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: [];
}

export interface NextBestActionRequest {
  entity_type?: string;
  entity_id?: string | number;
  deal_id?: number;
  lead_id?: number;
  force?: boolean;
  actorId?: string | null;
  correlationId?: string;
}

export interface NextBestActionResponse {
  data: {
    recommendation_id: string;
    entity_type: 'lead' | 'deal';
    entity_id: number;
    deal_id?: number;
    lead_id?: number;
    action: string;
    action_label: string;
    reason: string;
    confidence: number;
    status: string;
    recommendation_text: string;
    agent_run_id: string;
    playbook_citation?: {
      playbook_id: string;
      playbook_title: string;
      chunk_id: string;
      chunk_title: string;
      excerpt: string;
    } | null;
  };
  meta: { request_id: string };
  errors: [];
}

export type { LeadScoreFactor, ScoreBand };
