export interface AcceptanceByTypeRow {
  recommendation_type: string;
  accepted: number;
  dismissed: number;
  pending: number;
}

export interface DismissReasonRow {
  reason: string;
  count: number;
}

export interface AiDismissReasonMetrics {
  from: string;
  to: string;
  recommendation_type: string | null;
  dismissed: number;
  top_dismiss_reasons: DismissReasonRow[];
}

export interface AiDismissReasonMetricsResponse {
  data: AiDismissReasonMetrics;
  meta: { request_id: string };
  errors: [];
}

export interface AiAcceptanceMetrics {
  acceptance_rate_pct: number | null;
  accepted: number;
  dismissed: number;
  pending: number;
  total_resolved: number;
  by_type: AcceptanceByTypeRow[];
  top_dismiss_reasons: DismissReasonRow[];
  from: string;
  to: string;
}

export interface AiAcceptanceMetricsResponse {
  data: AiAcceptanceMetrics;
  meta: { request_id: string };
  errors: [];
}

export interface AiRecommendationInboxItem {
  id: string;
  entity_type: string;
  entity_id: string;
  recommendation_type: string;
  recommendation_text: string;
  status: string;
  dismissed_reason: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string;
}

export interface AiRecommendationInboxResponse {
  data: {
    recommendations: AiRecommendationInboxItem[];
    total: number;
  };
  meta: { request_id: string };
  errors: [];
}

export interface AiAdoptionDailyDauRow {
  day: string;
  dau: number;
}

export interface AiAdoptionMetrics {
  from: string;
  to: string;
  pilot_denominator: number;
  copilot_dau_latest: number;
  copilot_dau_avg: number;
  copilot_dau_rate_pct: number;
  copilot_dau_target_pct: number;
  copilot_dau_gate_pass: boolean;
  acceptance_rate_pct: number | null;
  acceptance_target_pct: number;
  acceptance_gate_pass: boolean;
  accepted: number;
  dismissed: number;
  pending: number;
  total_resolved: number;
  daily_dau: AiAdoptionDailyDauRow[];
  dod_v1_summary: {
    acceptance_ge_40: boolean;
    dau_ge_60_pilot: boolean;
  };
}

export interface AiAdoptionMetricsResponse {
  data: AiAdoptionMetrics;
  meta: { request_id: string };
  errors: [];
}

export const DISMISS_REASON_PRESETS = [
  { value: 'wrong_tone', label: 'Sai tone' },
  { value: 'wrong_fact', label: 'Sai thông tin' },
  { value: 'not_needed', label: 'Không cần' },
  { value: 'other', label: 'Khác' },
] as const;
