import { LeadScoreFactor } from './lead-score.types';

export type ChurnHealthBand = 'healthy' | 'watch' | 'at_risk' | 'critical';
export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ChurnHealthSignals {
  contract_days_until_end: number | null;
  contract_amount_vnd: number;
  lifecycle_id: number | null;
  tickets_open: number;
  tickets_last_7d: number;
  tickets_prev_7d: number;
  ticket_spike: boolean;
  negative_tickets_open: number;
  payment_overdue_vnd: number;
  payment_overdue_count: number;
}

export interface ChurnHealthContext {
  client_id: string;
  client_name: string;
  owner_am_id: string | null;
  status: string;
  signals: ChurnHealthSignals;
}

export interface ChurnHealthSnapshot {
  health_score: number;
  health_band: ChurnHealthBand;
  churn_risk_pct: number;
  risk_level: ChurnRiskLevel;
  ticket_spike: boolean;
  factors: LeadScoreFactor[];
  signals: ChurnHealthSignals;
  renewal_recommended: boolean;
}

export interface CustomerHealthScoreRecord {
  id: string;
  client_id: string;
  score: number;
  components_json: Record<string, unknown>;
  ai_score_id: string | null;
  calculated_at: string;
  created_at: string;
}

export interface ChurnHealthClientView {
  client_id: string;
  client_code: string;
  client_name: string;
  owner_am_id: string | null;
  status: string;
  health: ChurnHealthSnapshot;
  score_id: string;
  calculated_at: string;
}

export interface ChurnScoreRequest {
  client_id?: string;
  force?: boolean;
  limit?: number;
  actorId?: string | null;
  correlationId?: string;
}

export interface ChurnScoreResponse {
  data: {
    scored: number;
    skipped: number;
    scanned: number;
    agent_run_id: string;
    scored_at: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface ChurnHealthDashboardResponse {
  data: {
    clients: ChurnHealthClientView[];
    total: number;
    filters: {
      sort: string;
      order: string;
      ticket_spike: boolean;
    };
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface ChurnHealthClientResponse {
  data: ChurnHealthClientView | null;
  meta: { request_id: string };
  errors: unknown[];
}

export interface ChurnRecoveryPlanEntry {
  id: string;
  client_id: string;
  client_name: string;
  note: string;
  actor_id: string;
  actor_name: string | null;
  created_at: string;
}

export interface ChurnRecoveryPlanRequest {
  clientId: string;
  note: string;
  actorId?: string | null;
  actorName?: string | null;
  correlationId?: string;
}

export interface ChurnRecoveryPlanResult {
  id: string;
  client_id: string;
  note: string;
  created_at: string;
}

export interface ChurnRecoveryPlanResponse {
  data: ChurnRecoveryPlanResult;
  meta: { request_id: string };
  errors: unknown[];
}

export interface ChurnRecoveryTimelineResponse {
  data: {
    client_id: string;
    entries: ChurnRecoveryPlanEntry[];
    total: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}
