export interface UpsellPathDef {
  target_slug: string;
  target_label: string;
  reason: string;
  priority: number;
}

export interface UpsellActiveService {
  lifecycle_id: number;
  service_slug: string;
  service_label: string;
  contract_title: string;
  stage: string;
}

export interface UpsellContext {
  clientId: string;
  clientName: string | null;
  healthScore: number | null;
  healthBand: 'healthy' | 'watch' | 'critical' | null;
  activeServices: UpsellActiveService[];
  channels: string[];
  ownedServiceSlugs: string[];
}

export interface UpsellEngineSuggestion {
  source_service_slug: string;
  source_service_label: string;
  target_service_slug: string;
  target_service_label: string;
  lifecycle_id: number | null;
  reason: string;
  confidence: number;
  draft_text: string;
  rule_id: string;
}

export interface UpsellSuggestionView {
  id: string;
  client_id: string;
  source_service_slug: string;
  source_service_label: string;
  target_service_slug: string;
  target_service_label: string;
  lifecycle_id: number | null;
  health_score: number | null;
  confidence: number;
  reason: string;
  draft_text: string;
  status: string;
  follow_up_task_id: number | null;
  service_delivery_url: string | null;
}

export interface UpsellSuggestRequest {
  client_id?: string;
  force?: boolean;
  limit?: number;
  actorId?: string | null;
  correlationId?: string;
}

export interface UpsellSuggestResponse {
  data: {
    client_id: string | null;
    created: number;
    skipped: number;
    suggestions: UpsellSuggestionView[];
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: [];
}

export interface UpsellListResponse {
  data: {
    client_id: string;
    suggestions: UpsellSuggestionView[];
    total: number;
  };
  meta: { request_id: string };
  errors: [];
}

export interface UpsellApproveResponse {
  data: {
    id: string;
    status: 'accepted';
    follow_up_task_id: number | null;
    service_delivery_url: string | null;
    note: string;
  };
  meta: { request_id: string };
  errors: [];
}

export interface UpsellDismissResponse {
  data: { id: string; status: 'dismissed' };
  meta: { request_id: string };
  errors: [];
}
