import { LeadScoreFactor } from './lead-score.types';

export interface ForecastDealRow {
  deal_id: number;
  title: string;
  pipeline_stage: string;
  deal_value_vnd: number;
  weighted_vnd: number;
  stalled_days: number;
  is_stalled: boolean;
}

export interface ForecastStageBucket {
  stage: string;
  label: string;
  deal_count: number;
  raw_vnd: number;
  weighted_vnd: number;
}

export interface ForecastEngineInput {
  deals: ForecastDealRow[];
  stageLabels: Record<string, string>;
  month: number;
  now?: Date;
}

export interface ForecastEngineResult {
  pipeline_amount: number;
  forecast_amount: number;
  ai_adjustment: number;
  best_case_amount: number;
  confidence_score: number;
  stalled_deal_count: number;
  factors: LeadScoreFactor[];
  stage_buckets: ForecastStageBucket[];
  summary_note: string;
}

export interface RevenueForecastSnapshotRecord {
  id: string;
  snapshot_date: string;
  pipeline_amount: number;
  forecast_amount: number;
  ai_adjustment: number | null;
  best_case_amount: number;
  committed_amount: number;
  confidence_score: number | null;
  committed_by: string | null;
  committed_at: string | null;
  agent_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ForecastSnapshotRequest {
  actorId?: string | null;
  correlationId?: string;
  force?: boolean;
  snapshotDate?: string;
}

export interface ForecastSnapshotResult {
  snapshot_id: string;
  snapshot_date: string;
  pipeline_amount: number;
  forecast_amount: number;
  ai_adjustment: number;
  best_case_amount: number;
  stalled_deal_count: number;
  skipped: boolean;
  agent_run_id: string;
  scanned_at: string;
}

export interface ForecastSnapshotResponse {
  data: ForecastSnapshotResult;
  meta: { request_id: string };
  errors: unknown[];
}

export interface ForecastMapePriorMonth {
  month: string;
  committed_vnd: number;
  actual_vnd: number;
  mape_pct: number | null;
  warn: boolean;
}

export interface ForecastDashboardData {
  year: number;
  month: number;
  period_label: string;
  snapshot: RevenueForecastSnapshotRecord | null;
  pipeline_amount: number;
  forecast_amount: number;
  ai_adjustment: number;
  committed_amount: number;
  best_case_amount: number;
  actual_prior_month_vnd: number;
  stalled_deal_count: number;
  factors: LeadScoreFactor[];
  stage_buckets: ForecastStageBucket[];
  summary_note: string;
  mape_prior_month: ForecastMapePriorMonth | null;
  can_commit: boolean;
  is_committed: boolean;
}

export interface ForecastDashboardResponse {
  data: ForecastDashboardData;
  meta: { request_id: string };
  errors: unknown[];
}

export interface ForecastCommitRequest {
  snapshotId: string;
  committedAmountVnd: number;
  actorId?: string | null;
  actorEmail?: string | null;
  correlationId?: string;
  acknowledgeMapeWarning?: boolean;
}

export interface ForecastCommitResult {
  snapshot_id: string;
  committed_amount: number;
  committed_by: string;
  committed_at: string;
}

export interface ForecastCommitResponse {
  data: ForecastCommitResult;
  meta: { request_id: string };
  errors: unknown[];
}

/** AI-UC-013 step 7 — committed vs actual T-1 for leadership dashboard. */
export interface ForecastVarianceData {
  period_label: string;
  committed_vnd: number;
  actual_vnd: number;
  variance_vnd: number;
  variance_pct: number | null;
  mape_pct: number | null;
  warn: boolean;
}

export interface ForecastVarianceResponse {
  data: ForecastVarianceData;
  meta: { request_id: string };
  errors: unknown[];
}

/** §19.3 #2 — MAPE report artifact for manager. */
export interface ForecastMapeReportRow {
  year: number;
  month: number;
  period_label: string;
  committed_vnd: number;
  actual_vnd: number;
  variance_vnd: number;
  mape_pct: number | null;
  warn: boolean;
  committed_by: string | null;
  committed_at: string | null;
}

export interface ForecastMapeReportData {
  generated_at: string;
  months: number;
  target_mape_pct: number;
  rows: ForecastMapeReportRow[];
  summary: {
    avg_mape_pct: number | null;
    months_over_target: number;
  };
}

export interface ForecastMapeReportResponse {
  data: ForecastMapeReportData;
  meta: { request_id: string };
  errors: unknown[];
}
