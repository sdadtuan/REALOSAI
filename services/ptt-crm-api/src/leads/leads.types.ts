import type { LeadFlowKind } from '../leads-funnel/lead-flow-kind.util';

export interface LeadV1 {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  client_id: string | null;
  campaign_id: string | null;
  external_lead_id: string | null;
  owner_id: number | null;
  created_at: string;
  received_at: string;
  is_duplicate: boolean;
  /** B2B Project OS */
  b2b_project_id?: string | null;
  owner_company_id?: string | null;
  assign_strategy?: string | null;
  assign_confidence?: number | null;
  lead_flow_kind?: LeadFlowKind;
  /** B2B list enrichments (W1) */
  project_code?: string | null;
  ai_band?: 'hot' | 'warm' | 'cold' | null;
  sla_state?: 'na' | 'ok' | 'warning' | 'breach' | null;
  in_call?: boolean;
  /** WIN-4-B — financial ABAC pilot (from meta_json.financial). */
  expected_value?: number | null;
  margin_pct?: number | null;
  review_queue?: {
    active: boolean;
    message?: string;
    hours_waiting?: number | null;
  };
}

export interface LeadsListResponseV1 {
  leads: LeadV1[];
  total: number;
  limit: number;
  offset: number;
}

export interface LeadRow {
  id: number;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  source: string | null;
  owner_id: number | null;
  created_at: string | null;
  is_duplicate: number | null;
  meta_json: string | null;
}

export interface PgLeadRow {
  sqlite_lead_id: number | string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  source: string | null;
  owner_id: number | null;
  is_duplicate: boolean | null;
  agency_client_id: string | null;
  channel: string | null;
  external_lead_id: string | null;
  campaign_id: string | null;
  received_at: Date | string | null;
  created_at: Date | string | null;
  meta_json?: string | Record<string, unknown> | null;
  first_assigned_at?: Date | string | null;
  b2b_project_id?: string | null;
  owner_company_id?: string | null;
  assign_strategy?: string | null;
  assign_confidence?: number | null;
  /** B2B list enrichment (from PG joins) */
  project_code?: string | null;
  lead_score?: number | null;
  b2b_call_state?: string | null;
  b2b_has_call?: boolean | null;
  b2b_call_answered?: boolean | null;
  b2b_assigned_at?: Date | string | null;
  b2b_hop_count?: number | null;
}

export type ReviewQueueListFilter = 'only' | 'hide';

export interface ListLeadsQuery {
  client_id?: string;
  status?: string;
  source?: string;
  channel?: string;
  q?: string;
  limit?: number;
  offset?: number;
  review_queue_only?: boolean;
  /** When false, include review-queue leads in the main list. Default hide when funnel enabled. */
  hide_review_queue?: boolean;
  review_queue_filter?: ReviewQueueListFilter;
  /** Populated by LeadsService when filtering PG reads via SQLite funnel state. */
  review_queue_ids?: number[];
  owner_id?: number;
  unassigned_only?: boolean;
  /** Filter by operational flow (spa CSKH vs B2B sales vs RE buyer). */
  lead_flow_kind?: LeadFlowKind;
  /** WIN-3-C — restrict list to assigned agency clients. */
  allowed_client_ids?: string[];
  /** B2B Project OS — project-scoped list visibility (flag on + B2B flow). */
  b2b_list_scope?: {
    staffId: number;
    viewAll: boolean;
    isDirector: boolean;
  };
}

export interface CreateLeadV1Body {
  full_name: string;
  phone?: string;
  email?: string;
  status?: string;
  source?: string;
  channel?: string;
  client_id?: string | null;
  campaign_id?: string | null;
  external_lead_id?: string | null;
  owner_id?: number | null;
  lead_flow_kind?: LeadFlowKind;
  b2b_project_id?: string | null;
  owner_company_id?: string | null;
}

export interface PatchLeadV1Body {
  owner_id?: number | null;
  /** B2B manual owner change — required when PTT_B2B_PROJECT_OS=1 + b2b_prospect. */
  split?: 'keep_first_touch' | 'reset_closer' | 'no_split';
  status?: string;
  score?: number;
  assigned_by?: string;
  /** Required for terminal status changes when PTT_LEAD_STATUS_GATE=1. */
  audit_note?: string;
  /** GDKD / assign cap only — bypass B2 & outreach gates with status_override_reason. */
  allow_status_override?: boolean;
  status_override_reason?: string;
  /** WIN-4-B — requires crm_leads.view_financial */
  expected_value?: number | null;
  margin_pct?: number | null;
}

export interface PatchLeadResult {
  lead: LeadV1;
  assigned: boolean;
  scored: boolean;
  status_changed?: boolean;
  previous_status?: string | null;
}

export interface BulkAssignLeadsBody {
  lead_ids: number[];
  owner_id: number;
  reason?: string;
}

export interface BulkAssignLeadsResult {
  assigned: number;
  skipped: number;
  lead_ids: number[];
}
