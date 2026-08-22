import { LeadScoreFactor } from './lead-score.types';

export type RenewalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type RenewalStatus = 'open' | 'in_progress' | 'renewed' | 'lost' | 'deferred';
export type RenewalTriggerWindow = 90 | 60 | 30;
export type RenewalChannel = 'email' | 'zalo';

export interface RenewalContractCandidate {
  contract_id: number;
  agency_client_id: string;
  client_name: string;
  contract_title: string;
  ends_on: string;
  amount_vnd: number;
  days_until_end: number;
  trigger_window: RenewalTriggerWindow;
  lifecycle_id: number | null;
}

export interface RenewalHealthSnapshot {
  health_score: number;
  health_band: 'healthy' | 'watch' | 'at_risk' | 'critical';
  churn_risk_pct: number;
  risk_level: RenewalRiskLevel;
  factors: LeadScoreFactor[];
}

export interface RenewalOpportunityRecord {
  id: string;
  client_id: string;
  contract_ref: string;
  renewal_date: string;
  risk_level: RenewalRiskLevel;
  status: RenewalStatus;
  owner_am_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RenewalScanRequest {
  actorId?: string | null;
  correlationId?: string;
  windows?: RenewalTriggerWindow[];
}

export interface RenewalScanResult {
  scanned: number;
  created: number;
  skipped: number;
  agent_run_id: string;
  scanned_at: string;
}

export interface RenewalScanResponse {
  data: RenewalScanResult;
  meta: { request_id: string };
  errors: unknown[];
}

export interface RenewalOpportunityView {
  id: string;
  client_id: string;
  contract_id: number;
  contract_title: string;
  amount_vnd: number;
  renewal_date: string;
  days_until_end: number;
  trigger_window: RenewalTriggerWindow;
  risk_level: RenewalRiskLevel;
  status: RenewalStatus;
  health: RenewalHealthSnapshot;
  draft_text: string | null;
  draft_channel: RenewalChannel | null;
  recommendation_id: string | null;
  lifecycle_id: number | null;
  service_delivery_url: string | null;
  follow_up_task_id: number | null;
  outcome: string | null;
  owner_am_id: string | null;
  updated_at: string;
}

export interface RenewalListResponse {
  data: {
    client_id: string;
    opportunities: RenewalOpportunityView[];
    total: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface RenewalDraftResponse {
  data: {
    opportunity_id: string;
    draft_text: string;
    channel: RenewalChannel;
    recommendation_id: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface RenewalApproveResponse {
  data: {
    opportunity_id: string;
    status: RenewalStatus;
    follow_up_task_id: number | null;
    service_delivery_url: string | null;
    note: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface RenewalOutcomeResponse {
  data: {
    opportunity_id: string;
    status: RenewalStatus;
    outcome: 'renewed' | 'lost';
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface RenewalPortfolioSummary {
  t90_count: number;
  t60_count: number;
  t30_count: number;
  drill_href: string;
}

export interface RenewalPortfolioSummaryResponse {
  data: RenewalPortfolioSummary;
  meta: { request_id: string };
  errors: unknown[];
}
