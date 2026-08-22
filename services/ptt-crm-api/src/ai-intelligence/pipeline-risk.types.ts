export interface PipelineRiskScanRequest {
  limit?: number;
  actorId?: string | null;
  correlationId?: string;
}

export interface PipelineRiskScanResult {
  scanned: number;
  at_risk_found: number;
  alerts_created: number;
  alerts_skipped: number;
  alerts_cleared: number;
  agent_run_id: string;
  scanned_at: string;
}

export interface PipelineRiskDealRow {
  deal_id: number;
  title: string;
  pipeline_stage: string;
  stalled_days: number;
  deal_score: number;
  score_band: string;
  recommendation_id: string;
  staff_name: string | null;
  customer_name: string | null;
  follow_up_owner_id: number | null;
  follow_up_owner_name: string | null;
  assigned_at: string | null;
  scanned_at: string;
  status: string;
}

export interface PipelineRiskAssignRequest {
  recommendationId: string;
  staffId: number;
  staffName: string;
  actorId?: string | null;
  correlationId?: string;
}

export interface PipelineRiskAssignResult {
  recommendation_id: string;
  deal_id: number;
  follow_up_owner_id: number;
  follow_up_owner_name: string;
  assigned_at: string;
  assigned_by: string;
}

export interface PipelineRiskAssignResponse {
  data: PipelineRiskAssignResult;
  meta: { request_id: string };
  errors: [];
}

export interface PipelineRiskActivityRequest {
  recommendationId: string;
  note: string;
  actorId?: string | null;
  correlationId?: string;
}

export interface PipelineRiskActivityResult {
  recommendation_id: string;
  deal_id: number;
  event_id: number;
  risk_cleared: boolean;
  logged_at: string;
}

export interface PipelineRiskActivityResponse {
  data: PipelineRiskActivityResult;
  meta: { request_id: string };
  errors: [];
}

export interface PipelineRiskListResult {
  deals: PipelineRiskDealRow[];
  total: number;
  last_scan_at: string | null;
}

export interface PipelineRiskScanResponse {
  data: PipelineRiskScanResult;
  meta: { request_id: string };
  errors: [];
}

export interface PipelineRiskListResponse {
  data: PipelineRiskListResult;
  meta: { request_id: string };
  errors: [];
}
