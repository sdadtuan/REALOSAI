import type { StaffSectionCap, StoredStaffUser } from './auth';

export const API_BASE =
  (process.env.NEXT_PUBLIC_PTT_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

export interface StaffLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  user: StoredStaffUser;
}

export interface StaffMeResponse extends StoredStaffUser {
  caps: StaffSectionCap[];
}

export interface LeadRow {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  client_id: string | null;
  owner_id: number | null;
  created_at: string;
  received_at: string;
  is_duplicate: boolean;
  b2b_project_id?: string | null;
  lead_flow_kind?: 'spa_operational' | 'b2b_prospect' | string | null;
  project_code?: string | null;
  ai_band?: 'hot' | 'warm' | 'cold' | null;
  sla_state?: 'na' | 'ok' | 'warning' | 'breach' | null;
  in_call?: boolean;
  expected_value?: number | null;
  margin_pct?: number | null;
  review_queue?: {
    active: boolean;
    message?: string;
    hours_waiting?: number | null;
  };
}

export interface LeadsListResponse {
  leads: LeadRow[];
  total: number;
  limit: number;
  offset: number;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('Invalid JSON response', res.status);
  }
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function staffLogin(email: string, password: string): Promise<StaffLoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/staff/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await parseJson<StaffLoginResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Login failed', res.status);
  }
  return body;
}

export async function sandboxLogin(
  username: string,
  password: string,
): Promise<StaffLoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/gtm/sandbox/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body = await parseJson<
    StaffLoginResponse & { error?: string; message?: string; code?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.code ?? body.error ?? body.message ?? 'Sandbox login failed', res.status);
  }
  return body;
}

export interface StaffSsoConfig {
  mode: 'nest' | 'keycloak' | 'dual';
  issuer: string | null;
  client_id: string;
  nest_login_allowed: boolean;
  mfa_required_positions: string[];
}

export async function fetchStaffSsoConfig(): Promise<StaffSsoConfig> {
  const res = await fetch(`${API_BASE}/api/v1/staff/auth/sso/config`, { cache: 'no-store' });
  const body = await parseJson<StaffSsoConfig & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'SSO config unavailable', res.status);
  }
  return body;
}

export async function staffOidcExchange(params: {
  code: string;
  redirect_uri: string;
  code_verifier: string;
}): Promise<StaffLoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/staff/auth/oidc/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await parseJson<
    StaffLoginResponse & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'OIDC exchange failed', res.status);
  }
  return body;
}

export interface StaffKeycloakGroupMapRow {
  kc_group: string;
  position_id: number;
  position_code?: string;
  position_name?: string;
  default_set_codes: string[];
  active: boolean;
  updated_at: string;
  updated_by: string;
}

export async function fetchStaffSsoGroups(token: string): Promise<{ groups: StaffKeycloakGroupMapRow[] }> {
  const res = await fetch(`${API_BASE}/api/v1/staff/admin/sso/groups`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ groups: StaffKeycloakGroupMapRow[]; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Không tải group map', res.status);
  }
  return { groups: body.groups ?? [] };
}

export async function upsertStaffSsoGroup(
  token: string,
  kcGroup: string,
  payload: { position_id: number; default_set_codes?: string[]; active?: boolean },
): Promise<{ group: StaffKeycloakGroupMapRow }> {
  const res = await fetch(
    `${API_BASE}/api/v1/staff/admin/sso/groups/${encodeURIComponent(kcGroup)}`,
    {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );
  const body = await parseJson<{ group: StaffKeycloakGroupMapRow; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Lưu group map thất bại', res.status);
  }
  return body;
}

export async function staffRefresh(refreshToken: string): Promise<StaffLoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/staff/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await parseJson<StaffLoginResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Refresh failed', res.status);
  }
  return body;
}

export async function staffMe(token: string): Promise<StaffMeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/staff/auth/me`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<StaffMeResponse & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Unauthorized', res.status);
  }
  return body;
}

export interface StaffRosterRow {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
}

export async function fetchStaffRoster(token: string): Promise<{ staff: StaffRosterRow[] }> {
  const res = await fetch(`${API_BASE}/api/v1/staff/auth/roster`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ staff: StaffRosterRow[]; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Không tải danh sách nhân viên', res.status);
  }
  return { staff: body.staff ?? [] };
}

export async function fetchLeads(
  token: string,
  params?: {
    q?: string;
    status?: string;
    source?: string;
    channel?: string;
    owner_id?: number;
    unassigned_only?: boolean;
    limit?: number;
    offset?: number;
    hide_review_queue?: boolean;
    review_queue_only?: boolean;
    lead_flow_kind?: 'spa_operational' | 'b2b_prospect';
  },
): Promise<LeadsListResponse> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  if (params?.source) qs.set('source', params.source);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.owner_id != null) qs.set('owner_id', String(params.owner_id));
  if (params?.unassigned_only) qs.set('unassigned_only', '1');
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.offset !== undefined) qs.set('offset', String(params.offset));
  if (params?.hide_review_queue === false) qs.set('hide_review_queue', '0');
  if (params?.review_queue_only) qs.set('review_queue_only', '1');
  if (params?.lead_flow_kind) qs.set('lead_flow_kind', params.lead_flow_kind);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/leads${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LeadsListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Leads fetch failed', res.status);
  }
  return body;
}

export async function bulkAssignLeads(
  token: string,
  input: { lead_ids: number[]; owner_id: number; reason?: string },
): Promise<{ assigned: number; skipped: number; lead_ids: number[] }> {
  return crmFetch(token, '/api/v1/leads/bulk-assign', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface CreateLeadBody {
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
  lead_flow_kind?: 'spa_operational' | 'b2b_prospect';
  b2b_project_id?: string | null;
}

export async function createLead(token: string, body: CreateLeadBody): Promise<LeadRow> {
  return crmFetch(token, '/api/v1/leads', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface LeadImportResult {
  ok: boolean;
  created: number;
  skipped: number;
  leads: LeadRow[];
  errors: Array<{ row: number; message: string }>;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1] ?? fallback;
}

async function downloadBinary(
  token: string,
  path: string,
  fallbackFilename: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'Download failed', res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackFilename);
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadLeadsImportTemplate(token: string): Promise<void> {
  await downloadBinary(token, '/api/v1/leads/import/template.xlsx', 'lead-import-template.xlsx');
}

export function downloadStaffRosterTemplateCsv(): void {
  const headers = ['name', 'internal_code', 'email', 'phone', 'job_title', 'department', 'active'];
  const sample = ['Nguyễn Văn A', 'NV001', 'a@pttads.vn', '0901234567', 'Content', 'Solution', '1'];
  const csv = `${headers.join(',')}\n${sample.join(',')}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'staff-roster-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportLeadsXlsx(
  token: string,
  params?: { q?: string; status?: string; source?: string; channel?: string; ids?: number[] },
): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  if (params?.source) qs.set('source', params.source);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.ids?.length) qs.set('ids', params.ids.join(','));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  await downloadBinary(token, `/api/v1/leads/export.xlsx${suffix}`, 'leads-export.xlsx');
}

export async function importLeadsXlsx(token: string, file: File): Promise<LeadImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/leads/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  const body = await parseJson<LeadImportResult & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Import failed', res.status);
  }
  return body;
}

export interface CskhSlaTierSnapshot {
  tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
  label: string;
  sla_state: 'ok' | 'warning' | 'breach' | 'na';
  deadline_at: string | null;
  completed_at: string | null;
  elapsed_minutes: number | null;
  deadline_minutes: number;
}

export interface CskhSlaTierSummary {
  breach: number;
  warning: number;
  ok: number;
  active: number;
  compliance_pct: number | null;
  target_pct: number;
  compliance_pass: boolean | null;
  evaluated: number;
}

export interface CskhBoardRow {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: string;
  source: string;
  channel: string;
  owner_id: number | null;
  owner_name: string | null;
  received_at: string;
  created_at: string;
  first_call_at: string | null;
  b2_completed_at: string | null;
  closed_at: string | null;
  sla_state: 'ok' | 'warning' | 'breach' | 'na';
  sla_tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h' | null;
  sla_tiers: CskhSlaTierSnapshot[];
  sla_minutes_elapsed: number | null;
  sla_deadline_at: string | null;
  next_follow_up_at: string | null;
}

export interface CskhBoardResponse {
  ok: boolean;
  items: CskhBoardRow[];
  total: number;
  limit: number;
  offset: number;
  summary: { total: number; breach: number; warning: number; ok: number };
  sla_dashboard: {
    tiers: Record<'first_call_15m' | 'b2_complete_4h' | 'close_24h', CskhSlaTierSummary>;
    selected_tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h' | 'all';
  };
}

export async function fetchCskhBoard(
  token: string,
  params?: {
    owner_id?: number;
    status?: string;
    source?: string;
    channel?: string;
    q?: string;
    sla_filter?: 'all' | 'breach' | 'warning' | 'open';
    sla_tier?: 'first_call_15m' | 'b2_complete_4h' | 'close_24h' | 'all';
    limit?: number;
    offset?: number;
  },
): Promise<CskhBoardResponse> {
  const qs = new URLSearchParams();
  if (params?.owner_id != null) qs.set('owner_id', String(params.owner_id));
  if (params?.status) qs.set('status', params.status);
  if (params?.source) qs.set('source', params.source);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.q) qs.set('q', params.q);
  if (params?.sla_filter && params.sla_filter !== 'all') qs.set('sla_filter', params.sla_filter);
  if (params?.sla_tier && params.sla_tier !== 'all') qs.set('sla_tier', params.sla_tier);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/crm/cskh-board${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhBoardResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'CSKH board fetch failed', res.status);
  }
  return body;
}

export interface CskhRepPerformanceRow {
  owner_id: number;
  owner_name: string;
  active_leads: number;
  breach_first_call: number;
  breach_b2: number;
  breach_close: number;
  warning_total: number;
  weighted_breach_score: number;
  performance_score: number;
  rank: number;
}

export interface CskhTriageSuggestion {
  from_owner_id: number;
  from_owner_name: string;
  breach_first_call_count: number;
  lead_ids: number[];
  suggested_to_owner_id: number | null;
  suggested_to_owner_name: string | null;
  reason: string;
}

export interface CskhManagerIntelligence {
  ok: boolean;
  generated_at: string;
  rep_performance: CskhRepPerformanceRow[];
  triage_suggestions: CskhTriageSuggestion[];
  top_breaches: Array<{
    lead_id: number;
    full_name: string;
    owner_name: string | null;
    tier_label: string;
    root_cause_label: string;
    elapsed_minutes: number | null;
  }>;
  root_cause_counts: Record<string, number>;
  team_ai_acceptance_pct: number | null;
  sla_daily_digest: {
    narrative: string;
    email_preview: string;
  };
}

export async function fetchCskhManagerIntelligence(token: string): Promise<CskhManagerIntelligence> {
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/manager-intelligence`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhManagerIntelligence & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Manager intelligence fetch failed', res.status);
  }
  return body;
}

export interface CskhBreachBacklogSnapshot {
  ok: true;
  generated_at: string;
  shift: {
    shift_key: 'morning' | 'afternoon' | 'night';
    shift_label: string;
    shift_end_ict: string;
  };
  target: number;
  backlog_count: number;
  gate_pass: boolean;
  unique_breach_leads: number;
  tier_breach_counts: Record<'first_call_15m' | 'b2_complete_4h' | 'close_24h', number>;
  breach_lead_ids: number[];
}

export async function fetchCskhBreachBacklog(token: string): Promise<CskhBreachBacklogSnapshot> {
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/breach-backlog`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhBreachBacklogSnapshot & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Breach backlog fetch failed', res.status);
  }
  return body;
}

export interface CskhShiftHandoffReport {
  ok: true;
  shift: {
    shift_key: 'morning' | 'afternoon' | 'night';
    shift_label: string;
    shift_end_ict: string;
  };
  generated_at: string;
  breach_backlog: CskhBreachBacklogSnapshot;
  open_leads_by_tier: Record<'first_call_15m' | 'b2_complete_4h' | 'close_24h', number>;
  review_queue_pending: number;
  review_queue_max_age_hours: number | null;
  top_breach_leads: Array<{
    id: number;
    name: string;
    tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
    owner_name: string;
  }>;
  handoff_notes: string;
}

export async function fetchCskhShiftHandoff(token: string): Promise<CskhShiftHandoffReport> {
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/shift-handoff`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhShiftHandoffReport & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Shift handoff fetch failed', res.status);
  }
  return body;
}

export interface CskhHomeSummary {
  ok: true;
  generated_at: string;
  leads_new_today: number;
  sla: {
    breach_count: number;
    warning_count: number;
    compliance_pct: number | null;
    drill_href: string;
  };
  review_queue: {
    pending_count: number;
    max_age_hours: number | null;
    drill_href: string;
  };
  ai?: {
    copilot_dau_pct: number | null;
    pilot_denominator: number;
    copilot_dau_latest: number;
    drill_href: string;
  };
}

export async function fetchCskhHomeSummary(token: string): Promise<CskhHomeSummary> {
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/home-summary`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhHomeSummary & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Home summary fetch failed', res.status);
  }
  return body;
}

export type SlaPredictRisk = 'low' | 'medium' | 'high' | 'imminent';

export interface SlaPredictRow {
  lead_id: number;
  lead_name: string;
  owner_id: number | null;
  tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
  minutes_remaining: number;
  risk: SlaPredictRisk;
  suggested_action: 'log_call' | 'complete_b2' | 'set_chot_audit' | 'set_lost_reason' | 'reassign';
  reason: string;
}

export interface CskhSlaPredictionsResponse {
  ok: true;
  generated_at: string;
  items: SlaPredictRow[];
  total: number;
}

export async function fetchCskhSlaPredictions(
  token: string,
  params?: { owner_id?: number },
): Promise<CskhSlaPredictionsResponse> {
  const qs = new URLSearchParams();
  if (params?.owner_id != null) qs.set('owner_id', String(params.owner_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/sla-predictions${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhSlaPredictionsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'SLA predictions fetch failed', res.status);
  }
  return body;
}

export function cskhSlaAlertsStreamUrl(token: string): string {
  const qs = new URLSearchParams({ access_token: token });
  return `${API_BASE}/api/crm/cskh-board/sla-alerts/stream?${qs.toString()}`;
}

export async function createLeadSlaAutoTask(
  token: string,
  leadId: number,
  body: {
    tier: SlaPredictRow['tier'];
    suggested_action: SlaPredictRow['suggested_action'];
    message?: string;
  },
): Promise<{ ok: boolean; activity_id: number; content: string }> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/sla-auto-task`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok: boolean; activity_id: number; content: string; error?: string }>(
    res,
  );
  if (!res.ok) throw new ApiError(out.error ?? 'SLA auto-task failed', res.status);
  return out;
}

export async function bulkAssignCskhLeads(
  token: string,
  body: { lead_ids: number[]; to_user_id: number; reason: string },
): Promise<{ ok: boolean; assigned: number; total: number }> {
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/bulk-assign`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok: boolean; assigned: number; total: number; error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Bulk assign failed', res.status);
  return out;
}

export async function bulkRescheduleCskhLeads(
  token: string,
  body: { lead_ids: number[]; follow_up_at: string; note?: string },
): Promise<{ ok: boolean; rescheduled: number }> {
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/bulk-reschedule`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok: boolean; rescheduled: number; error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Bulk reschedule failed', res.status);
  return out;
}

export function cskhBoardExportUrl(params?: {
  owner_id?: number;
  status?: string;
  sla_filter?: string;
  sla_tier?: string;
  q?: string;
  format?: 'csv' | 'xlsx';
}): string {
  const qs = new URLSearchParams();
  if (params?.owner_id != null) qs.set('owner_id', String(params.owner_id));
  if (params?.status) qs.set('status', params.status);
  if (params?.sla_filter) qs.set('sla_filter', params.sla_filter);
  if (params?.sla_tier) qs.set('sla_tier', params.sla_tier);
  if (params?.q) qs.set('q', params.q);
  if (params?.format === 'xlsx') qs.set('format', 'xlsx');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return `${API_BASE}/api/crm/cskh-board/export${suffix}`;
}

export async function fetchLead(token: string, id: number): Promise<LeadRow> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${id}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LeadRow & { error?: string; message?: string }>(res);
  if (!res.ok) {
    const detail = body.error ?? body.message;
    throw new ApiError(
      detail ? String(detail) : `Lead fetch failed (HTTP ${res.status})`,
      res.status,
    );
  }
  return body;
}

export interface LeadStatusOptionRow {
  id: string;
  label: string;
}

export interface LeadStatusOptionsResponse {
  current_status: string;
  current_status_label: string;
  lead_flow_kind: 'spa_operational' | 'b2b_prospect';
  gate_enabled: boolean;
  allowed_next: LeadStatusOptionRow[];
  hints: string[];
}

export async function fetchLeadStatusOptions(
  token: string,
  leadId: number,
): Promise<LeadStatusOptionsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/status-options`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LeadStatusOptionsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Lead status options failed', res.status);
  }
  return body;
}

export type SlaCareNbaAction = 'log_call' | 'complete_b2' | 'set_chot_audit' | 'set_lost_reason';

export interface SlaCareTierSnapshot {
  tier: 'first_call_15m' | 'b2_complete_4h' | 'close_24h';
  label: string;
  sla_state: 'ok' | 'warning' | 'breach' | 'na';
  deadline_at: string | null;
  completed_at: string | null;
  elapsed_minutes: number | null;
  deadline_minutes: number;
}

export interface LeadSlaCareContext {
  lead_id: number;
  lead_flow_kind: 'spa_operational' | 'b2b_prospect';
  applicable: boolean;
  sla_tiers: SlaCareTierSnapshot[];
  worst_sla_state: string;
  worst_sla_tier: string | null;
  banner: {
    severity: 'ok' | 'warning' | 'breach' | 'hidden';
    title: string;
    message: string;
    tier: string | null;
  };
  nba: {
    action: SlaCareNbaAction;
    action_label: string;
    reason: string;
    urgency: 'normal' | 'warning' | 'breach';
    cta_target: string;
    sla_tier: string | null;
  } | null;
  drafts: {
    call_script: {
      greeting: string;
      intro: string;
      questions: string[];
      closing: string;
      disclaimer: string;
    } | null;
    audit_note: {
      template: string;
      hints: string[];
    } | null;
  };
  lost_reason_options: Array<{ id: string; label: string; confidence: number }>;
  sci?: {
    enabled: boolean;
    status: string | null;
    prep_stage: string | null;
    opening: string | null;
    script_full: string | null;
    close_readiness_score: number | null;
  } | null;
}

export async function fetchLeadSlaCareContext(
  token: string,
  leadId: number,
): Promise<LeadSlaCareContext> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/sla-care-context`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LeadSlaCareContext & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Lead SLA care context failed', res.status);
  }
  return body;
}

export interface CopilotActivitySnippet {
  id: number;
  activity_type: string;
  activity_type_label: string;
  content: string;
  created_at: string;
  user_name: string;
}

export interface CopilotCatalogService {
  slug: string;
  name: string;
  description: string;
}

export interface LeadCopilotContext {
  lead_id: number;
  generated_at: string;
  applicable: boolean;
  lead_flow_kind: 'spa_operational' | 'b2b_prospect';
  sla: {
    sla_tiers: SlaCareTierSnapshot[];
    worst_sla_state: string;
    worst_sla_tier: string | null;
    banner: LeadSlaCareContext['banner'];
    nba: LeadSlaCareContext['nba'];
    drafts: LeadSlaCareContext['drafts'];
    lost_reason_options: LeadSlaCareContext['lost_reason_options'];
    sci?: LeadSlaCareContext['sci'];
  };
  funnel: {
    care_pipeline: {
      current_stage_key: string;
      current_stage_label: string;
      contact_ok_reported: boolean;
      all_complete: boolean;
    };
    presales_care_gate: { complete: boolean; message: string };
    review_queue: { active: boolean; message?: string };
    presales_on_lead_enabled: boolean;
  } | null;
  activities: CopilotActivitySnippet[];
  catalog: { services: CopilotCatalogService[] } | null;
  closed_loop: LeadClosedLoopContext;
  meeting_prep?: {
    status: string;
    prep_stage: string | null;
    summary: string;
    top_dv_codes: string[];
    close_readiness_score: number | null;
  } | null;
}

/** Unified copilot context — replaces separate sla-care / closed-loop fetches on lead detail. */
export async function fetchLeadCopilotContext(
  token: string,
  leadId: number,
): Promise<LeadCopilotContext> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/copilot-context`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LeadCopilotContext & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Lead copilot context failed', res.status);
  }
  return body;
}

export type ChotQaFlag =
  | 'missing_deal_value'
  | 'no_call_before_chot'
  | 'missing_b2_confirmation'
  | 'weak_audit_evidence'
  | 'no_sci_before_chot';

export interface LeadClosedLoopContext {
  lead_id: number;
  applicable: boolean;
  status: string;
  deal_value_vnd: number;
  chot_package: string | null;
  qa_flags: ChotQaFlag[];
  qa_flag_labels: Record<ChotQaFlag, string>;
  closed_loop_at: string | null;
  call_script_source: 'ai_v1' | 'sop' | 'sci' | 'unknown';
  hub_mapped: boolean;
  hub_href: string | null;
  roas_hint: string;
}

export async function fetchLeadClosedLoopContext(
  token: string,
  leadId: number,
): Promise<LeadClosedLoopContext> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/closed-loop-context`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LeadClosedLoopContext & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Lead closed-loop context failed', res.status);
  }
  return body;
}

export async function trackLeadCallScriptCopy(
  token: string,
  leadId: number,
  source: 'sci' | 'ai_v1' | 'sop' = 'sci',
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/closed-loop/script-copy`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string }>(res);
    throw new ApiError(body.error ?? 'Track script copy failed', res.status);
  }
}

export interface CskhClosedLoopDashboard {
  ok: boolean;
  generated_at: string;
  window_days: number;
  summary: {
    chot_total: number;
    deal_value_fill_pct: number;
    vnd_fill_target_pct: number;
    vnd_fill_gate_pass: boolean | null;
    qa_flagged_pct: number;
    avg_deal_value_vnd: number;
  };
  qa_flag_labels: Record<ChotQaFlag, string>;
  qa_samples: Array<{
    lead_id: number;
    full_name: string;
    owner_name: string | null;
    deal_value_vnd: number;
    qa_flags: ChotQaFlag[];
    closed_at: string | null;
  }>;
}

export async function fetchCskhClosedLoopDashboard(
  token: string,
  days = 30,
): Promise<CskhClosedLoopDashboard> {
  const qs = days !== 30 ? `?days=${days}` : '';
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/closed-loop-dashboard${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhClosedLoopDashboard & { error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Closed-loop dashboard failed', res.status);
  return body;
}

export interface GdkdEnterpriseKpiTile {
  id: string;
  label: string;
  value: number | null;
  value_display: string;
  target: number;
  target_display: string;
  comparator: 'gte' | 'lte' | 'lt';
  pass: boolean | null;
  gate_pass?: boolean | null;
  unit: 'pct' | 'count' | 'hours';
  source: string;
  drill_href: string;
  detail?: string;
}

export interface GdkdEnterpriseKpiResponse {
  ok: true;
  generated_at: string;
  window_days: number;
  closed_loop_window_days: number;
  tiles: GdkdEnterpriseKpiTile[];
  summary: {
    pass_count: number;
    fail_count: number;
    na_count: number;
    total: number;
  };
}

export async function fetchGdkdEnterpriseKpi(
  token: string,
  days = 7,
): Promise<GdkdEnterpriseKpiResponse> {
  const qs = days !== 7 ? `?days=${days}` : '';
  const res = await fetch(`${API_BASE}/api/crm/gdkd-enterprise/kpi${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<GdkdEnterpriseKpiResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'GDKD enterprise KPI failed', res.status);
  }
  return body;
}

export interface CskhPlaybookAbMetrics {
  ok?: boolean;
  window_days: number;
  ai_v1: { chot_count: number; closed_within_24h_pct: number; deal_value_fill_pct: number; avg_deal_value_vnd: number };
  sop: { chot_count: number; closed_within_24h_pct: number; deal_value_fill_pct: number; avg_deal_value_vnd: number };
  unknown: { chot_count: number; closed_within_24h_pct: number; deal_value_fill_pct: number; avg_deal_value_vnd: number };
  narrative: string;
}

export async function fetchCskhPlaybookAbMetrics(
  token: string,
  days = 30,
): Promise<CskhPlaybookAbMetrics> {
  const qs = days !== 30 ? `?days=${days}` : '';
  const res = await fetch(`${API_BASE}/api/crm/cskh-board/playbook-ab-metrics${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CskhPlaybookAbMetrics & { error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Playbook A/B metrics failed', res.status);
  return body;
}

export interface LeadAttributionData {
  lead_id: number;
  campaign_id: string | null;
  campaign_name: string | null;
  channel: string | null;
  client_id: string | null;
  hub_mapped: boolean;
  cpl_vnd: number | null;
  target_cpl_vnd: number | null;
  cpl_vs_target_pct: number | null;
  cpl_over_target: boolean;
  period_days: number;
  hub_href: string;
  ads_hub_href: string | null;
  ads_hub_label: string | null;
}

export async function fetchLeadAttribution(
  token: string,
  leadId: number,
): Promise<LeadAttributionData> {
  const res = await fetch(`${API_BASE}/api/crm/leads/${leadId}/attribution`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ data: LeadAttributionData; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Lead attribution fetch failed', res.status);
  }
  return body.data;
}

export interface PatchLeadBody {
  owner_id?: number | null;
  status?: string;
  assigned_by?: string;
}

export async function patchLead(
  token: string,
  id: number,
  body: PatchLeadBody,
): Promise<LeadRow> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${id}`, {
    method: 'PATCH',
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<LeadRow & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(out.error ?? out.message ?? 'Lead update failed', res.status);
  }
  return out;
}

export interface LeadActivityRow {
  id: number;
  lead_id: number;
  user_id: number | null;
  user_name: string;
  activity_type: string;
  activity_type_label: string;
  content: string;
  result: string;
  next_action: string;
  next_action_at: string;
  created_at: string;
  created_by: string;
}

export interface LeadStatusLogRow {
  id: number;
  lead_id: number;
  old_status: string;
  new_status: string;
  changed_by: string;
  note: string;
  created_at: string;
}

export interface LeadAssignmentLogRow {
  id: number;
  lead_id: number;
  from_user_id: number | null;
  from_name: string;
  to_user_id: number | null;
  to_name: string;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface LeadAuditBundle {
  status_logs: LeadStatusLogRow[];
  assignment_logs: LeadAssignmentLogRow[];
}

async function leadLegacyFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Lead legacy request failed', res.status);
  }
  return body;
}

export async function fetchLeadActivities(
  token: string,
  leadId: number,
  limit = 50,
): Promise<LeadActivityRow[]> {
  const out = await leadLegacyFetch<{ activities: LeadActivityRow[] }>(
    token,
    `/api/crm/leads/${leadId}/activities?limit=${limit}`,
  );
  return out.activities ?? [];
}

export async function createLeadActivity(
  token: string,
  leadId: number,
  body: {
    activity_type?: string;
    content?: string;
    result?: string;
    next_action?: string;
    next_action_at?: string;
  },
): Promise<LeadActivityRow> {
  const out = await leadLegacyFetch<{ activity: LeadActivityRow }>(
    token,
    `/api/crm/leads/${leadId}/activities`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return out.activity;
}

export async function fetchLeadAudit(token: string, leadId: number): Promise<LeadAuditBundle> {
  return leadLegacyFetch<LeadAuditBundle>(token, `/api/crm/leads/${leadId}/audit`);
}

export async function assignLead(
  token: string,
  leadId: number,
  body: { to_user_id: number; reason: string },
): Promise<LeadRow> {
  const out = await leadLegacyFetch<{ lead: LeadRow }>(token, `/api/crm/leads/${leadId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return out.lead;
}

// --- Wave B4: Lead funnel (care / review queue / presales) ---

export interface PresalesConsultProposalSla {
  tier: 'consult_proposal_48h';
  sla_state: 'na' | 'ok' | 'warning' | 'breach';
  started_at: string | null;
  deadline_at: string | null;
  hours_elapsed: number | null;
  hours_remaining: number | null;
  minutes_remaining: number | null;
  message: string;
  reminder_cta: string;
}

export interface PresalesConsultSlaSummary {
  active_consult: number;
  sla_ok: number;
  sla_warning: number;
  sla_breach: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
}

export interface PresalesFunnelMetricsResult {
  go_to_consult_median_hours: number | null;
  go_to_consult_p90_hours: number | null;
  go_to_consult_sample: number;
  go_to_handoff_median_hours: number | null;
  go_to_handoff_p90_hours: number | null;
  go_to_handoff_sample: number;
  handoff_to_release_median_hours: number | null;
  handoff_to_release_p90_hours: number | null;
  handoff_to_release_sample: number;
  consult_to_proposal_7d_pct: number;
  consult_to_proposal_7d_num: number;
  consult_to_proposal_7d_denom: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
  consult_form_completion_pct: number;
  consult_task_done_rate: number;
  consult_tasks_total: number;
  consult_tasks_done: number;
}

export interface PresalesFunnelMetricsResponse {
  ok: boolean;
  period_start: string | null;
  period_end: string | null;
  am_id: number | null;
  metrics: PresalesFunnelMetricsResult;
  labels: {
    consult_to_proposal_7d: string;
    consult_to_proposal_48h: string;
    go_to_handoff: string;
    handoff_to_release: string;
  };
}

export interface LeadFunnelSnapshot {
  lead_id: number;
  lead_flow_kind: 'spa_operational' | 'b2b_prospect';
  care_pipeline: {
    current_stage_key: string;
    current_stage_label: string;
    all_complete: boolean;
    contact_ok_reported: boolean;
    b2_negative_report_count?: number;
    last_b2_care_status?: string;
    last_b2_care_status_label?: string;
    stages: Array<{ key: string; label: string; hint: string; done: boolean; current: boolean }>;
  };
  presales_care_gate: { complete: boolean; message: string };
  review_queue: { active: boolean; message?: string; hours_waiting?: number | null };
  presales_on_lead_enabled: boolean;
  presales: {
    presales: { id: number; stage: string; service_slug: string; status: string };
    handoff?: {
      status: '' | 'pending' | 'with_solution' | 'released';
      handed_off_at: string;
      solution_owner_staff_id: number | null;
      solution_owner_name: string;
    };
    l2_docs?: {
      service_slug: string;
      items: Array<{ key: string; label: string; checked: boolean }>;
      total: number;
      done: number;
      complete: boolean;
      missing_labels: string[];
    };
    consult_proposal_sla?: PresalesConsultProposalSla;
    tasks: Record<
      string,
      Array<{
        id: number;
        title: string;
        description?: string;
        is_done: boolean;
        form_fields?: unknown;
        form_data?: Record<string, unknown>;
        ai_prompt_key?: string;
        ai_output?: string;
      }>
    >;
    advance: { can_advance_forward: boolean; block_reason: string; next_stage: string | null };
  } | null;
}

async function leadFunnelMutate<T>(token: string, path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await parseJson<T & { error?: string | string[]; message?: string | string[] }>(res);
  if (!res.ok) {
    const pick = (v: string | string[] | undefined) =>
      Array.isArray(v) ? v[0] : v;
    const msg =
      pick(body.message) ??
      pick(body.error) ??
      (res.status === 500 ? 'Lỗi server — kiểm tra log ptt-crm-api' : 'Lead funnel API failed');
    throw new ApiError(String(msg), res.status);
  }
  return body;
}

export async function fetchLeadFunnel(token: string, leadId: number): Promise<LeadFunnelSnapshot> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/funnel`, { method: 'GET' });
}

export async function submitLeadCareReport(
  token: string,
  leadId: number,
  body: {
    stage?: string;
    content?: string;
    care_status?: string;
    care_contact_type?: string;
  },
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/care-pipeline/report`, {
    method: 'POST',
    body: JSON.stringify({
      stage: 'first_contact',
      care_status: 'da_lien_he_thanh_cong',
      care_contact_type: 'goi_dien',
      ...body,
    }),
  });
}

export async function completeLeadCareStage(
  token: string,
  leadId: number,
  note: string,
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/care-pipeline/complete`, {
    method: 'POST',
    body: JSON.stringify({ stage: 'first_contact', note }),
  });
}

export async function fetchReviewQueueCount(token: string): Promise<{ count: number }> {
  return leadFunnelMutate(token, '/api/v1/leads/review-queue/count', { method: 'GET' });
}

export interface ReviewQueueMetrics {
  ok: true;
  generated_at: string;
  queue_count: number;
  max_hours: number | null;
  avg_hours: number | null;
  over_24h_count: number;
  over_24h_pct: number | null;
  target_hours: number;
  age_gate_pass: boolean;
}

export async function fetchReviewQueueMetrics(token: string): Promise<ReviewQueueMetrics> {
  return leadFunnelMutate(token, '/api/v1/leads/review-queue/metrics', { method: 'GET' });
}

export async function fetchReviewQueueLeads(
  token: string,
  limit = 50,
): Promise<{
  leads: Array<{
    id: number;
    full_name: string;
    phone: string;
    status?: string;
    review_queue: {
      message?: string;
      hours_waiting?: number | null;
      deadline_hours?: number;
    };
  }>;
  total?: number;
}> {
  return leadFunnelMutate(token, `/api/v1/leads/review-queue?limit=${limit}`, { method: 'GET' });
}

export interface ReviewQueueAiSummary {
  lead_id: number;
  summary_line: string;
  root_cause: string;
  suggested_owner_id: number | null;
  suggested_owner_name: string | null;
  suggest_reason: string;
  priority_score?: number;
  workload_note?: string;
  triage_source?: 'rules' | 'llm' | 'llm_stub';
}

export async function fetchReviewQueueAiSummaries(
  token: string,
  limit = 50,
  mode: 'rules' | 'llm' = 'rules',
): Promise<{
  ok: boolean;
  summaries: ReviewQueueAiSummary[];
  total: number;
  mode?: 'rules' | 'llm';
}> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (mode === 'llm') qs.set('mode', 'llm');
  return leadFunnelMutate(token, `/api/v1/leads/review-queue/ai-summaries?${qs.toString()}`, {
    method: 'GET',
  });
}

export async function releaseLeadReviewQueue(
  token: string,
  leadId: number,
  body: { mode: 'auto' | 'manual'; owner_id?: number; note?: string },
): Promise<{ ok: boolean }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/review-queue/release`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function ensureLeadPresales(
  token: string,
  leadId: number,
  serviceSlug: string,
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales`, {
    method: 'POST',
    body: JSON.stringify({ service_slug: serviceSlug }),
  });
}

export async function fetchLeadPresalesConsultGate(
  token: string,
  leadId: number,
): Promise<{
  ok: boolean;
  gate: {
    ok: boolean;
    level: string;
    messages: string[];
    requires_confirm: boolean;
    requires_override: boolean;
    decision?: string;
    bant_total?: number;
  };
  presales_stage: string;
}> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/consult-gate`, { method: 'GET' });
}

export async function advanceLeadPresales(
  token: string,
  leadId: number,
  body: { confirm?: boolean; override_reason?: string } = {},
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/advance`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface SolutionQueueRow {
  lead_id: number;
  full_name: string;
  phone: string;
  service_slug: string;
  presales_stage: string;
  handoff_status: 'pending' | 'with_solution';
  handed_off_at: string;
  solution_owner_staff_id: number | null;
  solution_owner_name: string;
  owner_id: number | null;
  owner_name: string;
}

export async function fetchSolutionQueue(
  token: string,
  opts: { status?: 'pending' | 'with_solution'; limit?: number } = {},
): Promise<{ ok: boolean; rows: SolutionQueueRow[]; count: number }> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return leadFunnelMutate(token, `/api/v1/leads/presales/solution-queue${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

export async function handoffLeadToSolution(
  token: string,
  leadId: number,
  body: { confirm?: boolean; override_reason?: string } = {},
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/handoff-solution`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function claimLeadSolution(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/claim-solution`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function releaseLeadToSales(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/release-to-sales`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface PresalesPolicyPreview {
  action: 'release' | 'claim';
  allowed: boolean;
  policy_id?: string;
  reason?: string;
  bundle_version: string;
}

export async function fetchPresalesPolicyPreview(
  token: string,
  leadId: number,
  action: 'release' | 'claim',
): Promise<PresalesPolicyPreview> {
  return leadFunnelMutate(
    token,
    `/api/v1/leads/${leadId}/presales/policy-preview?action=${encodeURIComponent(action)}`,
    { method: 'GET' },
  );
}

export async function fetchLeadPresalesMarketingPlan(
  token: string,
  leadId: number,
): Promise<{
  ok: boolean;
  plan: Record<string, unknown>;
  validation: { ok: boolean; messages: string[] };
  ai_draft?: { is_ai_draft: boolean; badge_vi?: string | null };
}> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/marketing-plan`, { method: 'GET' });
}

export async function patchLeadPresalesMarketingPlan(
  token: string,
  leadId: number,
  body: {
    name?: string;
    north_star?: string;
    objectives?: string;
    strategy_framework?: Record<string, string>;
    target_market_prof?: Record<string, string>;
  },
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot; validation: { ok: boolean; messages: string[] } }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/marketing-plan`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function postLeadPresalesMarketingPlanAiDraft(
  token: string,
  leadId: number,
): Promise<{
  ok: boolean;
  plan: Record<string, unknown>;
  funnel: LeadFunnelSnapshot;
  validation: { ok: boolean; messages: string[] };
  ai?: { stub_mode: boolean; model: string };
  ai_draft?: { is_ai_draft: boolean; badge_vi?: string | null };
  requires_sp_review?: boolean;
  badge_vi?: string;
}> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/marketing-plan/ai-draft`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface ProposalAdvanceGate {
  ok: boolean;
  level: 'ok' | 'block';
  messages: string[];
  consult_task_done: boolean;
  consult_task_total: number;
  consult_task_done_count: number;
  marketing_plan: { ok: boolean; messages: string[] };
}

export async function fetchLeadPresalesConsultBrief(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; brief: Record<string, unknown> }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/consult-brief`, { method: 'GET' });
}

export async function postLeadPresalesConsultPrefill(
  token: string,
  leadId: number,
  body: { overwrite?: boolean } = {},
): Promise<{ ok: boolean; filled: number; fields: string[]; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/consult-prefill`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchLeadPresalesProposalGate(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; gate: ProposalAdvanceGate; presales_stage: string }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/proposal-gate`, { method: 'GET' });
}

export interface DealRoomGateChip {
  key: string;
  label: string;
  status: 'ok' | 'warn' | 'block' | 'pending';
  message: string;
}

export interface DealRoomSnapshot {
  ok: true;
  lead_id: number;
  lead_name: string;
  lead_flow_kind: string;
  owner_id: number | null;
  owner_name: string | null;
  presales: NonNullable<LeadFunnelSnapshot['presales']>;
  gates: {
    g0_b2: DealRoomGateChip;
    g1_consult: DealRoomGateChip;
    g4_r5: DealRoomGateChip;
    g5_proposal: DealRoomGateChip;
    g6_accept: DealRoomGateChip;
  };
  marketing_plan: {
    name: string;
    north_star: string;
    objectives: string;
    strategy_framework: Record<string, string>;
    validation_ok: boolean;
    validation_messages: string[];
  };
  consult_progress: { done: number; total: number };
  quote: {
    proposal_id: number | null;
    status: string | null;
    total_vnd: number | null;
    customer_id: number | null;
    presales_id: number | null;
    service_slug: string;
    tiers: Array<{
      tier: string;
      tier_label: string;
      total_vnd: number | null;
      reference_min_vnd: number | null;
      reference_max_vnd: number | null;
      is_reference: boolean;
    }>;
    can_create: boolean;
    block_reason: string;
    sci_red_flag_block?: {
      active: boolean;
      reason: string;
      flags: Array<{ flag_vi: string; severity: 'warn' | 'block'; mitigation_vi: string }>;
    };
  };
  actions: {
    can_export_pack: boolean;
    can_share_teaser: boolean;
    proposals_href: string;
    teaser: {
      active: boolean;
      url: string | null;
      expires_at: string | null;
    };
  };
  proposal_gate: ProposalAdvanceGate;
  l1_checklist: Array<{ key: string; label: string; done: boolean }>;
  sci: DealRoomSciSlice;
}

export type DealRoomSciSlice = {
  available: boolean;
  prep_stage: string | null;
  close_readiness_score: number | null;
  opening_narrative_vi: string;
  slide_bullets_vi: string[];
  recommended_close_ask_vi: string;
  offer_ladder_summary: Array<{
    tier: string;
    sku_code: string;
    label_vi: string;
    anchor_role: string;
    price_hint_vnd: number | null;
  }>;
  red_flags: Array<{ flag_vi: string; severity: 'warn' | 'block'; mitigation_vi: string }>;
  playbook_slug: string | null;
  playbook_label_vi: string | null;
  href_prep: string;
};

export async function fetchLeadDealRoom(token: string, leadId: number): Promise<DealRoomSnapshot> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/deal-room`, { method: 'GET' });
}

export async function createDealRoomTeaser(
  token: string,
  leadId: number,
): Promise<{ ok: true; lead_id: number; url: string; expires_at: string; token_id: number }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/deal-room/teaser`, { method: 'POST' });
}

export async function revokeDealRoomTeaser(
  token: string,
  leadId: number,
): Promise<{ ok: true; lead_id: number; revoked: boolean }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/deal-room/teaser`, { method: 'DELETE' });
}

export async function exportLeadDealRoomPack(
  token: string,
  leadId: number,
  body: { proposal_id?: number; include_timeline?: boolean } = {},
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/deal-room/export-pack`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Export Pack PDF failed (${res.status})`;
    try {
      const data = (await res.json()) as { message?: string; messages?: string[] };
      message = data.message ?? data.messages?.[0] ?? message;
    } catch {
      const text = await res.text();
      if (text) message = text.slice(0, 300);
    }
    throw new Error(message);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? `PTT-DealPack-${leadId}.pdf`;
  const blob = await res.blob();
  return { blob, filename };
}

export async function createDealRoomQuote(
  token: string,
  body: {
    customer_id?: number;
    lead_id: number;
    presales_id?: number;
    service_slug?: string;
    package_tier?: 'basic' | 'standard' | 'premium';
    auto_lines?: boolean;
    notes?: string;
  },
) {
  return crmFetch<{
    id: number;
    customer_id: number;
    lead_id: number | null;
    total_vnd: number;
    status: string;
    lines?: Array<{
      dv_code: string;
      package_tier: string;
      final_price_vnd: number;
      reference_price_min: number;
      reference_price_max: number;
    }>;
  }>(token, '/api/crm/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchProposalsByLeadId(
  token: string,
  leadId: number,
): Promise<
  Array<{
    id: number;
    customer_id: number;
    lead_id: number | null;
    total_vnd: number;
    status: string;
    line_count?: number;
  }>
> {
  const out = await crmFetch<{ proposals: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/proposals?lead_id=${leadId}`,
  );
  return (out.proposals ?? []) as Array<{
    id: number;
    customer_id: number;
    lead_id: number | null;
    total_vnd: number;
    status: string;
    line_count?: number;
  }>;
}

export interface PresalesProposalHandoff {
  lead_id: number;
  customer_id: number | null;
  can_open: boolean;
  block_reason: string;
  service_slugs: string[];
  notes: string;
  proposals_href: string;
  deal_room_href?: string;
  proposal_gate_ok?: boolean;
  proposal_gate_messages?: string[];
  l1_checklist?: Array<{ key: string; label: string; done: boolean }>;
}

export async function fetchLeadPresalesProposalHandoff(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; handoff: PresalesProposalHandoff }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/proposal-handoff`, { method: 'GET' });
}

export async function patchLeadPresalesL2Docs(
  token: string,
  leadId: number,
  docs: Record<string, boolean>,
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/l2-docs`, {
    method: 'PATCH',
    body: JSON.stringify({ docs }),
  });
}

export async function fetchPresalesConsultSlaSummary(
  token: string,
  amId?: number,
): Promise<{ ok: boolean; summary: PresalesConsultSlaSummary }> {
  const qs = amId != null ? `?am_id=${amId}` : '';
  return leadFunnelMutate(token, `/api/v1/leads/presales/consult-sla/summary${qs}`, { method: 'GET' });
}

export async function fetchPresalesFunnelMetrics(
  token: string,
  opts: { amId?: number; periodStart?: string; periodEnd?: string } = {},
): Promise<PresalesFunnelMetricsResponse> {
  const params = new URLSearchParams();
  if (opts.amId != null) params.set('am_id', String(opts.amId));
  if (opts.periodStart) params.set('period_start', opts.periodStart);
  if (opts.periodEnd) params.set('period_end', opts.periodEnd);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return leadFunnelMutate(token, `/api/v1/leads/presales/funnel-metrics${qs}`, { method: 'GET' });
}

export async function postPresalesConsultSlaReminder(
  token: string,
  leadId: number,
  body: { message?: string } = {},
): Promise<{ ok: boolean; activity_id: number; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/consult-sla/reminder`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postLeadPresalesTaskAiAssist(
  token: string,
  leadId: number,
  taskId: number,
  body: { form_context?: Record<string, unknown> } = {},
): Promise<{ ok: boolean; task_id: number; ai_output: string; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/tasks/${taskId}/ai-assist`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchLeadPresalesTask(
  token: string,
  leadId: number,
  taskId: number,
  body: { is_done?: boolean; notes?: string; form_data?: Record<string, unknown> },
): Promise<{ ok: boolean; funnel: LeadFunnelSnapshot }> {
  return leadFunnelMutate(token, `/api/v1/leads/${leadId}/presales/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// --- Wave B5 S0: Contract → lifecycle promote ---

export interface ContractReadinessCheck {
  key: string;
  ok: boolean;
  label: string;
  message?: string;
}

export interface LeadContractRow {
  id: number;
  lead_id: number | null;
  title: string;
  status: string;
  amount_vnd: number;
  service_slug: string;
  signed_on: string;
  notes: string;
}

export interface ContractApprovalRow {
  id: number;
  contract_id: number;
  lead_id: number;
  status: string;
  requested_by: string;
  decided_by: string;
  amount_vnd: number;
  notes: string;
  decision_notes: string;
  created_at: string;
  contract_title?: string;
  lead_name?: string;
}

export async function fetchLeadContractReadiness(token: string, leadId: number) {
  return leadFunnelMutate<{
    ok: boolean;
    checks: ContractReadinessCheck[];
    contract: LeadContractRow | null;
    approval: ContractApprovalRow | null;
    lifecycle_id?: number | null;
  }>(token, `/api/v1/leads/${leadId}/contract/readiness`, { method: 'GET' });
}

export async function fetchLeadContract(token: string, leadId: number) {
  return leadFunnelMutate<{ contract: LeadContractRow | null; approval: ContractApprovalRow | null }>(
    token,
    `/api/v1/leads/${leadId}/contract`,
    { method: 'GET' },
  );
}

export async function createLeadContract(
  token: string,
  leadId: number,
  body: { title?: string; amount_vnd?: number; notes?: string },
) {
  return leadFunnelMutate<LeadContractRow>(token, `/api/v1/leads/${leadId}/contract`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchLeadContract(
  token: string,
  leadId: number,
  contractId: number,
  body: { title?: string; amount_vnd?: number; notes?: string },
) {
  return leadFunnelMutate<LeadContractRow>(token, `/api/v1/leads/${leadId}/contract/${contractId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function submitLeadContract(
  token: string,
  leadId: number,
  contractId: number,
  body: { notes?: string },
) {
  return leadFunnelMutate<ContractApprovalRow>(
    token,
    `/api/v1/leads/${leadId}/contract/${contractId}/submit`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function fetchPendingContractApprovals(token: string, limit = 50) {
  return leadFunnelMutate<{ approvals: ContractApprovalRow[] }>(
    token,
    `/api/v1/contracts/approvals/pending?limit=${limit}`,
    { method: 'GET' },
  );
}

export async function approveContractApproval(token: string, approvalId: number) {
  return leadFunnelMutate<{
    lifecycle_id: number;
    customer_id: number;
    contract: LeadContractRow;
    sop_auto_start?: {
      started: boolean;
      run_id?: number;
      idempotent?: boolean;
      reason?: string;
    };
  }>(token, `/api/v1/contracts/approvals/${approvalId}/approve`, { method: 'POST', body: '{}' });
}

export async function rejectContractApproval(
  token: string,
  approvalId: number,
  body: { decision_notes?: string },
) {
  return leadFunnelMutate<ContractApprovalRow>(token, `/api/v1/contracts/approvals/${approvalId}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchAgencyClientContracts(token: string, clientId: string) {
  return leadFunnelMutate<{ contracts: LeadContractRow[] }>(
    token,
    `/api/v1/agency/clients/${encodeURIComponent(clientId)}/contracts`,
    { method: 'GET' },
  );
}

export async function patchLeadLegacy(
  token: string,
  id: number,
  body: PatchLeadBody & { audit_note?: string },
): Promise<LeadRow> {
  const out = await leadLegacyFetch<{ lead: LeadRow }>(token, `/api/crm/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return out.lead;
}

export interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  company: string;
  lead_source: string;
  lead_source_label?: string;
  profile_notes: string;
  created_at: string;
}

export interface CustomerDetailBundle {
  customer: CustomerRow & {
    lead_source_note?: string;
    date_of_birth?: string;
    gender?: string;
    occupation?: string;
    interests?: string;
  };
  relations: Array<{ id: number; relation_type_label: string; full_name: string; phone: string }>;
  purchases: Array<{ id: number; product_name: string; amount_vnd: number; status_label: string }>;
  issues: Array<{ id: number; title: string; status_label: string; priority_label: string }>;
  stats: {
    relations_total: number;
    purchases_total: number;
    issues_total: number;
    issues_open: number;
  };
}

export interface CustomerTimelineEventRow {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  event_source: string;
  title: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  occurred_at: string;
  actor_id: string | null;
  linked_lead_id?: number;
}

export interface CustomerTimelineView {
  customer_id: number;
  linked_lead_ids: number[];
  events: CustomerTimelineEventRow[];
  total: number;
  limit: number;
  offset: number;
  timeline_ready: boolean;
}

export interface TimelineCompletenessView {
  total_leads: number;
  leads_with_timeline: number;
  completeness_pct: number;
  sample_limit: number;
  gate_pass: boolean;
}

export interface IntakeSessionRow {
  id: number;
  lead_id: number | null;
  lifecycle_id: number | null;
  service_slug: string;
  mode: string;
  status: string;
  contact_name: string;
  company_name: string;
  bant_total: number;
  decision: string;
  decision_reason: string;
  bant_json: Record<string, number>;
  answers_json: Record<string, unknown>;
  stakeholders_json?: Array<Record<string, string>>;
  commitments_json?: Array<Record<string, string>>;
  ai_summary?: string;
  updated_at: string;
}

async function crmFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'CRM request failed', res.status);
  }
  return body;
}

export async function fetchCustomers(
  token: string,
  params?: { q?: string; limit?: number },
): Promise<CustomerRow[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ customers: CustomerRow[] }>(token, `/api/crm/customers${suffix}`);
  return out.customers ?? [];
}

export async function fetchCustomerDetail(token: string, id: number): Promise<CustomerDetailBundle> {
  return crmFetch<CustomerDetailBundle>(token, `/api/crm/customers/${id}`);
}

export async function fetchCustomerTimeline(
  token: string,
  customerId: number,
  params?: { limit?: number; offset?: number; event_source?: string },
): Promise<CustomerTimelineView> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.event_source) qs.set('event_source', params.event_source);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch<CustomerTimelineView>(token, `/api/crm/customers/${customerId}/timeline${suffix}`);
}

export async function fetchTimelineCompleteness(
  token: string,
  sampleLimit = 500,
): Promise<TimelineCompletenessView> {
  const qs = new URLSearchParams({ sample_limit: String(sampleLimit) });
  const out = await crmFetch<{ data: TimelineCompletenessView }>(
    token,
    `/api/v1/ai/timeline/completeness?${qs.toString()}`,
  );
  return out.data;
}

export async function patchCustomer(
  token: string,
  id: number,
  body: Partial<CustomerRow>,
): Promise<CustomerRow> {
  return crmFetch<CustomerRow>(token, `/api/crm/customers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchIntakeDefinitions(token: string): Promise<{
  slugs: string[];
  common_slug: string;
  bant_rows: Array<{ label: string; hint: string }>;
}> {
  return crmFetch(token, '/api/crm/intake/definitions');
}

export async function fetchIntakeDefinitionBySlug(
  token: string,
  slug: string,
): Promise<{
  slug: string;
  title: string;
  phone_questions: string[];
  inperson_questions: string[];
  phone_question_items?: Array<{ key: string; text: string; critical?: boolean }>;
  inperson_question_items?: Array<{ key: string; text: string; critical?: boolean }>;
  bant_rows?: Array<{ key?: string; label: string; hint: string }>;
  red_flags?: string[];
  red_flag_items?: Array<{ key: string; text: string }>;
  urgency_triggers?: string[];
  schema_version?: number;
}> {
  return crmFetch(token, `/api/crm/intake/definitions/${encodeURIComponent(slug)}`);
}

export async function fetchIntakeSessions(
  token: string,
  params: { lead_id?: number; lifecycle_id?: number },
): Promise<IntakeSessionRow[]> {
  const qs = new URLSearchParams();
  if (params.lead_id) qs.set('lead_id', String(params.lead_id));
  if (params.lifecycle_id) qs.set('lifecycle_id', String(params.lifecycle_id));
  const out = await crmFetch<{ sessions: IntakeSessionRow[] }>(
    token,
    `/api/crm/intake/sessions?${qs.toString()}`,
  );
  return out.sessions ?? [];
}

export async function createIntakeSession(
  token: string,
  body: {
    lead_id?: number;
    lifecycle_id?: number;
    mode?: string;
    service_slug?: string;
    contact_name?: string;
    contact_role?: string;
    company_name?: string;
    source?: string;
    am_id?: number;
  },
): Promise<IntakeSessionRow> {
  return crmFetch<IntakeSessionRow>(token, '/api/crm/intake/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchIntakeSession(
  token: string,
  id: number,
  body: Record<string, unknown>,
): Promise<IntakeSessionRow> {
  return crmFetch<IntakeSessionRow>(token, `/api/crm/intake/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function completeIntakeSession(token: string, id: number): Promise<IntakeSessionRow> {
  return crmFetch<IntakeSessionRow>(token, `/api/crm/intake/sessions/${id}/complete`, {
    method: 'POST',
  });
}

export async function fetchIntakeStats(
  token: string,
  params?: { am_id?: number; by_am?: boolean },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.am_id != null) qs.set('am_id', String(params.am_id));
  if (params?.by_am) qs.set('by_am', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/intake/stats${suffix}`);
}

export async function reopenIntakeSession(token: string, id: number): Promise<IntakeSessionRow> {
  return crmFetch<IntakeSessionRow>(token, `/api/crm/intake/sessions/${id}/reopen`, {
    method: 'POST',
  });
}

export async function deleteIntakeSession(
  token: string,
  id: number,
): Promise<{ ok: boolean; deleted_id: number }> {
  return crmFetch<{ ok: boolean; deleted_id: number }>(token, `/api/crm/intake/sessions/${id}`, {
    method: 'DELETE',
  });
}

export async function generateIntakeAiSummary(token: string, id: number): Promise<IntakeSessionRow> {
  return crmFetch<IntakeSessionRow>(token, `/api/crm/intake/sessions/${id}/ai-summary`, {
    method: 'POST',
  });
}

export async function createCustomerRelation(
  token: string,
  customerId: number,
  body: { relation_type?: string; full_name: string; phone?: string; email?: string; notes?: string },
): Promise<CustomerDetailBundle['relations'][number]> {
  return crmFetch(token, `/api/crm/customers/${customerId}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function createCustomerIssue(
  token: string,
  customerId: number,
  body: { title: string; issue_type?: string; priority?: string; description?: string },
): Promise<CustomerDetailBundle['issues'][number]> {
  return crmFetch(token, `/api/crm/customers/${customerId}/issues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface CaseRow {
  id: number;
  customer_id: number;
  title: string;
  description: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  customer_name: string;
  customer_phone: string;
  assigned_to: string;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends CaseRow {
  events: Array<{ id: number; kind: string; body: string; created_at: string }>;
  care_reports: Array<{
    id: number;
    summary: string;
    contact_type_label: string;
    care_status_label: string;
    created_at: string;
  }>;
}

export async function fetchCases(
  token: string,
  params?: { q?: string; staff_id?: number },
): Promise<CaseRow[]> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.staff_id != null) qs.set('staff_id', String(params.staff_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ cases: CaseRow[] }>(token, `/api/crm/cases${suffix}`);
  return out.cases ?? [];
}

export async function fetchCaseDetail(token: string, id: number): Promise<CaseDetail> {
  return crmFetch<CaseDetail>(token, `/api/crm/cases/${id}`);
}

export async function patchCase(
  token: string,
  id: number,
  body: Partial<{
    title: string;
    status: string;
    priority: string;
    assigned_staff_id: number | null;
    pipeline_stage: string;
  }>,
): Promise<CaseRow> {
  return crmFetch<CaseRow>(token, `/api/crm/cases/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function addCaseEvent(
  token: string,
  caseId: number,
  body: { body: string },
): Promise<{ id: number; body: string; created_at: string }> {
  return crmFetch(token, `/api/crm/cases/${caseId}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function addCaseCareReport(
  token: string,
  caseId: number,
  body: { summary: string; contact_type?: string; care_status?: string; next_action?: string },
): Promise<{ id: number; summary: string; created_at: string }> {
  return crmFetch(token, `/api/crm/cases/${caseId}/care-reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface MarketingPlanRow {
  id: number;
  code: string;
  name: string;
  status: string;
  status_label?: string;
  priority: string;
  fiscal_year: number;
  period_label: string;
  owner_name: string;
  linked_campaign_count?: number;
  milestone_total?: number;
  milestone_done?: number;
  updated_at: string;
}

export interface ServiceLifecycleRow {
  id: number;
  lead_id: number | null;
  customer_id: number | null;
  service_slug: string;
  stage: string;
  status: string;
  assigned_am: number | null;
  notes: string;
  updated_at: string;
}

export interface SopTemplateRow {
  id: number;
  code: string;
  name: string;
  channel: string;
  active: number;
}

export interface SopRunRow {
  id: number;
  name: string;
  status: string;
  template_id: number | null;
  template_name: string | null;
  template_channel?: string | null;
  campaign_name?: string | null;
  start_date: string;
  updated_at: string;
  stats?: {
    total?: number;
    done?: number;
    skipped?: number;
    in_progress?: number;
    todo?: number;
    overdue?: number;
  };
}

export async function fetchMarketingPlans(
  token: string,
  params?: { fiscal_year?: number; status?: string; q?: string },
): Promise<MarketingPlanRow[]> {
  const qs = new URLSearchParams();
  if (params?.fiscal_year != null) qs.set('fiscal_year', String(params.fiscal_year));
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ plans: MarketingPlanRow[] }>(token, `/api/crm/marketing-plans${suffix}`);
  return out.plans ?? [];
}

export async function fetchMarketingPlanDetail(token: string, id: number): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/marketing-plans/${id}`);
}

export async function createMarketingPlan(
  token: string,
  body: { name: string; fiscal_year?: number; status?: string },
): Promise<MarketingPlanRow> {
  return crmFetch<MarketingPlanRow>(token, '/api/crm/marketing-plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchMarketingPlan(
  token: string,
  id: number,
  body: Partial<{ name: string; status: string; priority: string; notes: string; objectives: string }>,
): Promise<MarketingPlanRow> {
  return crmFetch<MarketingPlanRow>(token, `/api/crm/marketing-plans/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchServiceLifecycles(
  token: string,
  params?: { service_slug?: string; include_draft?: boolean; am_id?: string },
): Promise<{ lifecycles: ServiceLifecycleRow[]; funnel_stats?: Record<string, number> }> {
  const qs = new URLSearchParams();
  if (params?.service_slug) qs.set('service_slug', params.service_slug);
  if (params?.include_draft) qs.set('include_draft', '1');
  if (params?.am_id) qs.set('am_id', params.am_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch<{ lifecycles: ServiceLifecycleRow[]; funnel_stats?: Record<string, number> }>(
    token,
    `/api/crm/service-lifecycle${suffix}`,
  );
}

export async function fetchServiceLifecycleAdvanceInfo(
  token: string,
  id: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/advance-info`);
}

export async function fetchServiceLifecycleTasks(
  token: string,
  id: number,
): Promise<{ tasks: Record<string, Array<Record<string, unknown>>> }> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/tasks`);
}

export async function fetchServiceLifecycleProgress(
  token: string,
  id: number,
): Promise<{ progress: Record<string, { total: number; done: number; pct: number }> }> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/progress`);
}

export async function patchServiceLifecycleTask(
  token: string,
  lifecycleId: number,
  taskId: number,
  body: Partial<{ is_done: boolean; notes: string; form_data: Record<string, unknown> }>,
): Promise<{ task: Record<string, unknown> }> {
  return crmFetch(token, `/api/crm/service-lifecycle/${lifecycleId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchServiceLifecycleMarketingPlan(
  token: string,
  id: number,
): Promise<{
  plan: Record<string, unknown> | null;
  validation: { ok: boolean; messages: string[] };
  tmmt_core_keys?: string[];
  tmmt_prof_keys?: string[];
  tmmt_min_filled?: number;
  filled_count?: number;
}> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/marketing-plan`);
}

export async function fetchServiceLifecycleConsultBrief(
  token: string,
  id: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/consult-brief`);
}

export async function postServiceLifecycleConsultPrefill(
  token: string,
  id: number,
  body: { overwrite?: boolean },
): Promise<{ task_id: number | null; filled: number; fields: string[]; skipped_existing: string[] }> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/consult-prefill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchServiceLifecycleMarketingPlan(
  token: string,
  id: number,
  body: Record<string, unknown>,
): Promise<{ plan: Record<string, unknown>; validation: { ok: boolean; messages: string[] } }> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/marketing-plan`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchServiceLifecyclePresalesSummary(
  token: string,
  id: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/presales-summary`);
}

export async function fetchServiceLifecycleFinanceSummary(
  token: string,
  id: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/finance-summary`);
}

export async function fetchServiceLifecyclePayments(
  token: string,
  id: number,
): Promise<{ payments: Array<Record<string, unknown>> }> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/payments`);
}

export async function fetchServiceLifecycleContext(
  token: string,
  id: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/context`);
}

export async function fetchServiceLifecycleSop(token: string, id: number) {
  return crmFetch<{
    lifecycle_id: number;
    sop_run_id: number | null;
    auto_start_enabled: boolean;
    template_code: string;
    run: SopRunRow | null;
    tasks: Array<{
      id: number;
      position: number;
      title: string;
      role: string;
      due_date: string;
      status: string;
    }>;
    message?: string | null;
  }>(token, `/api/crm/service-lifecycle/${id}/sop`);
}

export async function fetchServiceLifecycleOnboardingBrief(token: string, id: number) {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/onboarding-brief`);
}

export async function fetchServiceLifecycleLaunchQa(token: string, id: number) {
  return crmFetch<{
    lifecycle_id: number;
    auto_start_enabled: boolean;
    has_context: boolean;
    client_id?: string;
    external_campaign_id?: string;
    campaign_name?: string;
    run: {
      id: string;
      status: string;
      launch_ready: boolean;
      checklist: Record<string, { label?: string; completed?: boolean; note?: string }>;
      started_at: string;
      completed_at: string | null;
    } | null;
    progress: { total: number; completed: number; percent: number };
    gate: { ok: boolean; launch_ready: boolean; progress_percent: number; messages: string[] };
    message?: string | null;
  }>(token, `/api/crm/service-lifecycle/${id}/launch-qa`);
}

export async function postServiceLifecycleLaunchQaStart(token: string, id: number) {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/launch-qa/start`, { method: 'POST' });
}

export async function patchServiceLifecycleLaunchQaChecklist(
  token: string,
  id: number,
  itemKey: string,
  body: { completed?: boolean; note?: string },
) {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/launch-qa/checklist/${encodeURIComponent(itemKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchServiceLifecycleCreativeBrief(token: string, id: number) {
  return crmFetch<{
    suggested_brief: { title: string; description: string; from_tmmt: boolean };
    creatives: Array<{ id: string; title: string; status: string; version: number; submitted_at: string }>;
    has_approved_creative: boolean;
    pending_creative?: { id: string; title: string; status: string; version: number } | null;
    latest_rejected?: { id: string; title: string; review_note: string | null; version: number } | null;
    portal_hint?: string | null;
    message?: string | null;
  }>(token, `/api/crm/service-lifecycle/${id}/creative-brief`);
}

export async function postServiceLifecycleCreativeSubmit(
  token: string,
  id: number,
  body: { title?: string; description?: string; asset_url?: string; asset_type?: string; resubmit?: boolean },
) {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/creative-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchLaunchQaStats(token: string) {
  return crmFetch<{ ok: boolean; stats: Record<string, number> }>(token, '/api/crm/launch-qa/stats');
}

export async function fetchCrmCreativesStats(token: string) {
  return crmFetch<{ ok: boolean; stats: Record<string, number> }>(token, '/api/crm/creatives/stats');
}

export async function fetchCrmCreatives(token: string, status = 'all', limit = 100, channel = 'all') {
  const qs = new URLSearchParams({ status, limit: String(limit) });
  if (channel && channel !== 'all') qs.set('channel', channel);
  return crmFetch<{
    ok: boolean;
    count: number;
    rows: Array<{
      id: string;
      client_id: string;
      title: string;
      status: string;
      version: number;
      channel?: string;
      external_campaign_id: string | null;
      external_campaign_name: string | null;
      submitted_at: string;
      reviewed_at: string | null;
      review_note: string | null;
      lifecycle_id: number | null;
    }>;
  }>(token, `/api/crm/creatives?${qs.toString()}`);
}

export async function postCrmCreativeSubmit(
  token: string,
  body: {
    client_id?: string;
    external_campaign_id?: string;
    external_campaign_name?: string;
    title?: string;
    description?: string;
    asset_url?: string;
    asset_type?: string;
    channel?: string;
    resubmit?: boolean;
  },
) {
  return crmFetch(token, '/api/crm/creatives/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchCrmCampaignWritesStats(token: string) {
  return crmFetch<{ ok: boolean; stats: Record<string, number> }>(token, '/api/crm/campaign-writes/stats');
}

export async function fetchCrmCampaignWrites(token: string, status = 'all', limit = 100) {
  const qs = new URLSearchParams({ status, limit: String(limit) });
  return crmFetch<{
    ok: boolean;
    count: number;
    rows: Array<{
      id: string;
      client_id: string;
      external_campaign_id: string;
      external_campaign_name: string | null;
      change_type: string;
      new_value: Record<string, unknown>;
      status: string;
      submitted_by: string;
      approved_by: string | null;
      executed_at: string | null;
      execution_error: string | null;
      created_at: string;
      lifecycle_id: number | null;
    }>;
  }>(token, `/api/crm/campaign-writes?${qs.toString()}`);
}

export async function postCrmCampaignWriteSubmit(
  token: string,
  body: {
    client_id?: string;
    external_campaign_id?: string;
    external_campaign_name?: string;
    daily_budget_vnd?: number;
  },
) {
  return crmFetch(token, '/api/crm/campaign-writes/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function postCrmCampaignWriteApprove(token: string, id: string, note?: string) {
  return crmFetch(token, `/api/crm/campaign-writes/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
}

export async function postCrmCampaignWriteReject(token: string, id: string, note?: string) {
  return crmFetch(token, `/api/crm/campaign-writes/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ note }),
  });
}

export async function fetchServiceLifecycleBudgetBrief(token: string, id: number) {
  return crmFetch<{
    suggested_budget_vnd: number | null;
    from_tmmt: boolean;
    has_executed_budget: boolean;
    pending_write?: {
      id: string;
      status: string;
      new_value: Record<string, unknown>;
      created_at: string;
    } | null;
    latest_execution_failed?: { id: string; execution_error: string | null } | null;
    pilot_check?: { warning?: string | null; stub_mode?: boolean } | null;
    hint?: string | null;
    message?: string | null;
  }>(token, `/api/crm/service-lifecycle/${id}/budget-brief`);
}

export async function postServiceLifecycleBudgetSubmit(token: string, id: number, dailyBudgetVnd: number) {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}/budget-submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ daily_budget_vnd: dailyBudgetVnd }),
  });
}

export async function fetchLaunchQaRuns(token: string, status = 'all', limit = 100) {
  const qs = new URLSearchParams({ status, limit: String(limit) });
  return crmFetch<{
    ok: boolean;
    status: string;
    count: number;
    runs: Array<{
      id: string;
      client_id: string;
      external_campaign_id: string;
      campaign_name: string | null;
      status: string;
      launch_ready: boolean;
      progress: { total: number; completed: number; percent: number };
      temporal_workflow_id: string | null;
      started_at: string;
      completed_at: string | null;
      lifecycle_id: number | null;
    }>;
  }>(token, `/api/crm/launch-qa/runs?${qs.toString()}`);
}

export async function createServiceLifecycleExpense(
  token: string,
  lifecycleId: number,
  body: { title?: string; category?: string; amount_vnd?: number; expense_on?: string; notes?: string },
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${lifecycleId}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchServiceLifecycleDetail(token: string, id: number): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/service-lifecycle/${id}`);
}

export async function patchServiceLifecycle(
  token: string,
  id: number,
  body: Partial<{
    stage: string;
    notes: string;
    service_slug: string;
    assigned_am: number | null;
    assigned_sp: number | null;
    finance_confirm: boolean;
    launch_qa_confirm: boolean;
  }>,
): Promise<ServiceLifecycleRow> {
  return crmFetch<ServiceLifecycleRow>(token, `/api/crm/service-lifecycle/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSopTemplates(token: string): Promise<SopTemplateRow[]> {
  const out = await crmFetch<{ templates: SopTemplateRow[] }>(token, '/api/crm/sop/templates');
  return out.templates ?? [];
}

export async function fetchSopRuns(token: string, status = 'active'): Promise<SopRunRow[]> {
  const out = await crmFetch<{ runs: SopRunRow[] }>(token, `/api/crm/sop/runs?status=${encodeURIComponent(status)}`);
  return out.runs ?? [];
}

export interface SopOverdueTaskRow {
  id: number;
  run_id: number;
  title: string;
  role: string;
  due_date: string;
  status: string;
  days_overdue: number;
  run_name: string;
  run_status: string;
  lifecycle_id: number | null;
}

export async function fetchSopOverdueTasks(token: string, limit = 100) {
  return crmFetch<{
    overdue_enabled: boolean;
    total: number;
    tasks: SopOverdueTaskRow[];
  }>(token, `/api/crm/sop/overdue-tasks?limit=${limit}`);
}

export async function createSopRun(
  token: string,
  body: { name: string; template_id?: number; start_date?: string },
): Promise<SopRunRow> {
  return crmFetch<SopRunRow>(token, '/api/crm/sop/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface SalesSummary {
  funnel?: Record<string, unknown>;
  active_plan?: Record<string, unknown> | null;
  counts?: Record<string, number>;
}

export interface SalesPlanRow {
  id: number;
  title: string;
  fiscal_year: number;
  status: string;
  revenue_target_vnd: number;
  updated_at: string;
}

export interface CrmStaffRow {
  id: number;
  name: string;
  internal_code: string;
  phone: string;
  email: string;
  job_title: string;
  department: string;
  active: number;
}

export interface KpiMetricRow {
  id: number;
  code: string;
  name: string;
  unit: string;
  active: number;
  sort_order: number;
}

export interface KpiBoardSummary {
  year: number;
  month: number;
  team?: string;
  summary: { critical: number; warn: number };
  staff_count: number;
  kpi_count: number;
  alerts: Array<Record<string, unknown>>;
}

export interface KpiSolutionDashboard {
  team: string;
  year: number;
  month: number;
  period_start: string;
  period_end: string;
  funnel: PresalesFunnelMetricsResponse;
  sla: PresalesConsultSlaSummary;
  queue: { pending: number; with_solution: number; total: number };
}

export interface KpiChartData {
  metric: Record<string, unknown>;
  higher_is_better: boolean;
  year: number;
  month: number;
  labels: string[];
  achievement_pct: Array<number | null>;
  staff_ids: number[];
}

export async function fetchSalesSummary(token: string): Promise<SalesSummary> {
  return crmFetch<SalesSummary>(token, '/api/crm/sales/summary');
}

export async function fetchSalesPlans(token: string): Promise<SalesPlanRow[]> {
  const out = await crmFetch<{ plans: SalesPlanRow[] }>(token, '/api/crm/sales/plans');
  return out.plans ?? [];
}

export async function createSalesPlan(
  token: string,
  body: { title: string; fiscal_year?: number },
): Promise<{ id: number }> {
  return crmFetch(token, '/api/crm/sales/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSalesPipelineCases(
  token: string,
  stage?: string,
): Promise<Array<Record<string, unknown>>> {
  const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
  const out = await crmFetch<{ cases: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/sales/pipeline-cases${qs}`,
  );
  return out.cases ?? [];
}

export async function fetchSalesPartners(
  token: string,
  q?: string,
): Promise<Array<Record<string, unknown>>> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const out = await crmFetch<{ partners: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/sales/partners${qs}`,
  );
  return out.partners ?? [];
}

export async function createSalesPartner(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/sales/partners', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSalesTrainings(token: string): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ trainings: Array<Record<string, unknown>> }>(token, '/api/crm/sales/trainings');
  return out.trainings ?? [];
}

export async function createSalesTraining(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/sales/trainings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSalesMarket(token: string): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ research: Array<Record<string, unknown>> }>(token, '/api/crm/sales/market');
  return out.research ?? [];
}

export async function createSalesMarketEntry(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/sales/market', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchSalesTransactions(token: string): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ transactions: Array<Record<string, unknown>> }>(
    token,
    '/api/crm/sales/transactions',
  );
  return out.transactions ?? [];
}

export async function fetchSalesReports(token: string): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/sales/reports');
}

export async function fetchKpiAlerts(
  token: string,
  params?: { year?: number; month?: number; staff_id?: number; team?: string },
): Promise<Array<Record<string, unknown>>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.staff_id != null) qs.set('staff_id', String(params.staff_id));
  if (params?.team) qs.set('team', params.team);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ alerts: Array<Record<string, unknown>> }>(token, `/api/crm/kpi/alerts${suffix}`);
  return out.alerts ?? [];
}

export async function fetchKpiBoard(
  token: string,
  params?: { year?: number; month?: number; team?: string },
): Promise<KpiBoardSummary> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.team) qs.set('team', params.team);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch<KpiBoardSummary>(token, `/api/crm/kpi/board${suffix}`);
}

export async function fetchKpiSolution(
  token: string,
  params?: { year?: number; month?: number; team?: string; period?: string },
): Promise<KpiSolutionDashboard> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.team) qs.set('team', params.team);
  if (params?.period) qs.set('period', params.period);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch<KpiSolutionDashboard>(token, `/api/crm/kpi/solution${suffix}`);
}

export async function fetchKpiChart(
  token: string,
  params: { metric_id: number; year?: number; month?: number; staff_id?: number; team?: string },
): Promise<KpiChartData> {
  const qs = new URLSearchParams({ metric_id: String(params.metric_id) });
  if (params.year != null) qs.set('year', String(params.year));
  if (params.month != null) qs.set('month', String(params.month));
  if (params.staff_id != null) qs.set('staff_id', String(params.staff_id));
  if (params.team) qs.set('team', params.team);
  return crmFetch<KpiChartData>(token, `/api/crm/kpi/chart?${qs.toString()}`);
}

export interface StaffKpiGridEntry {
  id: number;
  staff_id: number;
  staff_name: string;
  staff_code: string;
  metric_id: number;
  metric_name: string;
  metric_code: string;
  metric_unit: string;
  metric_higher_is_better: number;
  target_value: number | null;
  actual_value: number | null;
  status: string;
  year: number;
  month: number;
}

export async function fetchStaffKpi(
  token: string,
  params?: { year?: number; month?: number; staff_id?: number },
): Promise<StaffKpiGridEntry[]> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.staff_id != null) qs.set('staff_id', String(params.staff_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ staff_kpi: StaffKpiGridEntry[] }>(token, `/api/crm/staff/kpi${suffix}`);
  return out.staff_kpi ?? [];
}

export async function exportStaffKpi(
  token: string,
  params?: { year?: number; month?: number; staff_id?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.staff_id != null) qs.set('staff_id', String(params.staff_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/staff/kpi/export${suffix}`);
}

export interface KpiMetricTrend {
  metric_id: number;
  metric_name: string;
  year: number;
  month: number;
  months: number;
  labels: string[];
  avg_achievement_pct: number[];
}

export async function fetchKpiMetricTrend(
  token: string,
  params: { metric_id: number; year?: number; month?: number; months?: number },
): Promise<KpiMetricTrend> {
  const qs = new URLSearchParams({ metric_id: String(params.metric_id) });
  if (params.year != null) qs.set('year', String(params.year));
  if (params.month != null) qs.set('month', String(params.month));
  if (params.months != null) qs.set('months', String(params.months));
  return crmFetch<KpiMetricTrend>(token, `/api/crm/kpi/trend?${qs.toString()}`);
}

export async function downloadStaffKpiXlsx(
  token: string,
  params?: { year?: number; month?: number; staff_id?: number },
): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.staff_id != null) qs.set('staff_id', String(params.staff_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  await downloadBinary(token, `/api/crm/staff/kpi/export.xlsx${suffix}`, 'staff-kpi-export.xlsx');
}

export async function patchStaffKpiProgress(
  token: string,
  kpiId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/staff/kpi/${kpiId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchStaffLevels(token: string): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ staff_levels: Array<Record<string, unknown>> }>(token, '/api/crm/staff/levels');
  return out.staff_levels ?? [];
}

export async function saveStaffLevels(
  token: string,
  staffLevels: Array<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/staff/levels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staff_levels: staffLevels }),
  });
}

export async function fetchStaffCompetency(token: string): Promise<Record<string, unknown>> {
  const out = await crmFetch<{ competency: Record<string, unknown> }>(token, '/api/crm/staff/competency');
  return out.competency ?? {};
}

export async function saveStaffCompetency(
  token: string,
  competency: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/staff/competency', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ competency }),
  });
}

export async function importCrmStaff(
  token: string,
  rows: Array<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/staff/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
}

export interface ProposalRow {
  id: number;
  customer_id: number;
  lifecycle_id: number | null;
  service_slugs: string[];
  total_vnd: number;
  timeline_months: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export async function fetchProposals(token: string, customerId: number): Promise<ProposalRow[]> {
  const out = await crmFetch<{ proposals: ProposalRow[] }>(
    token,
    `/api/crm/proposals?customer_id=${customerId}`,
  );
  return out.proposals ?? [];
}

export async function fetchProposalDetail(token: string, id: number): Promise<ProposalRow> {
  return crmFetch<ProposalRow>(token, `/api/crm/proposals/${id}`);
}

export async function createProposal(
  token: string,
  body: {
    customer_id: number;
    lead_id?: number;
    service_slugs: string[];
    total_vnd?: number;
    timeline_months?: number;
    notes?: string;
    lifecycle_id?: number | null;
  },
): Promise<ProposalRow> {
  return crmFetch<ProposalRow>(token, '/api/crm/proposals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteProposal(token: string, id: number): Promise<void> {
  await crmFetch(token, `/api/crm/proposals/${id}`, { method: 'DELETE' });
}

export async function generateProposal(token: string, id: number): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/proposals/${id}/generate`, { method: 'POST' });
}

export interface ReProjectRow {
  id: number;
  code: string;
  name: string;
  project_type: string;
  project_type_label?: string;
  status: string;
  city: string;
  district: string;
  total_units: number;
  sold_units: number;
  updated_at: string;
}

export async function fetchReProjects(token: string, q?: string): Promise<ReProjectRow[]> {
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  const out = await crmFetch<{ projects: ReProjectRow[] }>(token, `/api/crm/re-projects${qs}`);
  return out.projects ?? [];
}

export async function fetchReProjectDetail(token: string, id: number): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${id}`);
}

export async function fetchReProjectSummary(token: string, id: number): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${id}/summary`);
}

export async function createReProject(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/re-projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchReProjectProducts(
  token: string,
  projectId: number,
): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ products: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/re-projects/${projectId}/products`,
  );
  return out.products ?? [];
}

export async function fetchReProjectInventoryByZone(
  token: string,
  projectId: number,
): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ zones: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/re-projects/${projectId}/inventory-by-zone`,
  );
  return out.zones ?? [];
}

export async function fetchReProjectAccountingDashboard(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/accounting/dashboard`);
}

export async function fetchReProjectCashFlow(
  token: string,
  projectId: number,
): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ lines: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/re-projects/${projectId}/accounting/cash-flow`,
  );
  return out.lines ?? [];
}

export async function createReProjectCashFlow(
  token: string,
  projectId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/accounting/cash-flow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function syncReProjectAccountingFromPlans(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/accounting/sync-from-plans`, { method: 'POST' });
}

export async function syncReProjectAccountingInventory(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/accounting/sync-inventory-revenue`, {
    method: 'POST',
  });
}

export async function fetchReProjectAccountingForecast(
  token: string,
  projectId: number,
  monthsAhead = 3,
): Promise<Record<string, unknown>> {
  return crmFetch(
    token,
    `/api/crm/re-projects/${projectId}/accounting/forecast?months_ahead=${monthsAhead}`,
  );
}

export async function fetchReProjectAccountingRisks(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/accounting/risk-predictions`);
}

export async function exportReProjectAccounting(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/accounting/export`);
}

export async function fetchReProjectKpis(
  token: string,
  projectId: number,
): Promise<{ kpis: Array<Record<string, unknown>>; board: Record<string, unknown> | null }> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/kpis`);
}

export async function createReProjectKpi(
  token: string,
  projectId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/kpis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function syncReProjectKpisToStaff(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/kpis/sync-to-staff`, { method: 'POST' });
}

export async function pullReProjectKpisFromStaff(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/kpis/pull-from-staff`, { method: 'POST' });
}

export async function refreshReProjectLeadsNewKpi(
  token: string,
  projectId: number,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/kpis/refresh-leads-new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchReProjectBudget(
  token: string,
  projectId: number,
): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ lines: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/re-projects/${projectId}/budget`,
  );
  return out.lines ?? [];
}

export async function createReProjectBudgetLine(
  token: string,
  projectId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/budget`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchReProjectRisks(
  token: string,
  projectId: number,
): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ risks: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/re-projects/${projectId}/risks`,
  );
  return out.risks ?? [];
}

export async function createReProjectRisk(
  token: string,
  projectId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/risks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchReProjectStaff(
  token: string,
  projectId: number,
): Promise<Array<Record<string, unknown>>> {
  const out = await crmFetch<{ staff: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/re-projects/${projectId}/staff`,
  );
  return out.staff ?? [];
}

export async function addReProjectStaff(
  token: string,
  projectId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchReProjectLeadConfig(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  const out = await crmFetch<{ config: Record<string, unknown> }>(
    token,
    `/api/crm/re-projects/${projectId}/lead-config`,
  );
  return out.config ?? {};
}

export async function saveReProjectLeadConfig(
  token: string,
  projectId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out = await crmFetch<{ config: Record<string, unknown> }>(
    token,
    `/api/crm/re-projects/${projectId}/lead-config`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return out.config ?? {};
}

export async function fetchReProjectWorkflow(
  token: string,
  projectId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/re-projects/${projectId}/workflow`);
}

export async function exportReProject(
  token: string,
  projectId: number,
  report = 'full',
): Promise<Record<string, unknown>> {
  const qs = report ? `?report=${encodeURIComponent(report)}` : '';
  return crmFetch(token, `/api/crm/re-projects/${projectId}/export${qs}`);
}

export async function fetchPayrollDashboard(
  token: string,
  params?: { year?: number; month?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/payroll/dashboard${suffix}`);
}

export async function fetchPayrollPeriod(
  token: string,
  year: number,
  month: number,
): Promise<{ payroll: Record<string, unknown> | null; lines: Array<Record<string, unknown>> }> {
  return crmFetch(token, `/api/crm/payroll?year=${year}&month=${month}`);
}

export async function computePayroll(
  token: string,
  body: { year: number; month: number; workdays_standard?: number },
): Promise<{ payroll: Record<string, unknown>; lines: Array<Record<string, unknown>> }> {
  return crmFetch(token, '/api/crm/payroll/compute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchPayrollPolicy(token: string): Promise<Record<string, unknown>> {
  const out = await crmFetch<{ policy: Record<string, unknown> }>(token, '/api/crm/payroll/policy');
  return out.policy ?? {};
}

export async function fetchPayrollAttendance(
  token: string,
  params?: { staff_id?: number; from?: string; to?: string },
): Promise<Array<Record<string, unknown>>> {
  const qs = new URLSearchParams();
  if (params?.staff_id != null) qs.set('staff_id', String(params.staff_id));
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ attendance: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/payroll/attendance${suffix}`,
  );
  return out.attendance ?? [];
}

export async function exportPayrollJson(
  token: string,
  params?: { year?: number; month?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ period: 'month' });
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  return crmFetch(token, `/api/crm/payroll/export?${qs.toString()}`);
}

export async function downloadPayrollXlsx(
  token: string,
  params?: { year?: number; month?: number },
): Promise<void> {
  const qs = new URLSearchParams({ period: 'month' });
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  await downloadBinary(token, `/api/crm/payroll/export.xlsx?${qs.toString()}`, 'payroll-export.xlsx');
}

export async function savePayrollPolicy(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/payroll/policy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchFinanceBusinessDashboard(
  token: string,
  params?: { year?: number; month?: number; trend_months?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.trend_months != null) qs.set('trend_months', String(params.trend_months));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/finance/business-dashboard${suffix}`);
}

export async function fetchFinanceKpiAlerts(
  token: string,
  params?: { year?: number; month?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/finance/kpi-alerts${suffix}`);
}

export async function fetchFinanceKpiTrends(
  token: string,
  params?: { year?: number; month?: number; trend_months?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.trend_months != null) qs.set('trend_months', String(params.trend_months));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/finance/kpi-trends${suffix}`);
}

export async function fetchFinanceKpiConfig(token: string): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/finance/kpi-config');
}

export async function patchFinanceKpiConfig(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/finance/kpi-config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchFinanceFinancials(
  token: string,
  params?: { year?: number; month?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/finance/financials${suffix}`);
}

export async function fetchFinanceIntelligence(
  token: string,
  params?: { year?: number; month?: number; months?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  if (params?.months != null) qs.set('months', String(params.months));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/finance/intelligence${suffix}`);
}

export async function fetchFinanceArAging(token: string): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/finance/ar-aging');
}

export interface OrderRow {
  id: number;
  reference_code: string;
  customer_id: number;
  contract_id: number | null;
  proposal_id: number | null;
  lifecycle_id: number | null;
  status: string;
  order_date: string;
  total_vnd: number;
  billing_type: string;
  notes: string;
}

export interface InvoiceRow {
  id: number;
  invoice_number: string;
  order_id: number | null;
  contract_id: number | null;
  lifecycle_id: number | null;
  customer_id: number;
  status: string;
  issued_on: string;
  due_on: string;
  amount_vnd: number;
  paid_vnd: number;
  notes: string;
}

export async function fetchOrders(
  token: string,
  params?: { customer_id?: number; lifecycle_id?: number; status?: string },
): Promise<{ orders: OrderRow[] }> {
  const qs = new URLSearchParams();
  if (params?.customer_id != null) qs.set('customer_id', String(params.customer_id));
  if (params?.lifecycle_id != null) qs.set('lifecycle_id', String(params.lifecycle_id));
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/orders${suffix}`);
}

export async function fetchInvoices(
  token: string,
  params?: { customer_id?: number; lifecycle_id?: number; status?: string; overdue?: boolean },
): Promise<{ invoices: InvoiceRow[] }> {
  const qs = new URLSearchParams();
  if (params?.customer_id != null) qs.set('customer_id', String(params.customer_id));
  if (params?.lifecycle_id != null) qs.set('lifecycle_id', String(params.lifecycle_id));
  if (params?.status) qs.set('status', params.status);
  if (params?.overdue) qs.set('overdue', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/invoices${suffix}`);
}

export async function postOrderFromProposal(token: string, proposalId: number) {
  return crmFetch<{ order: OrderRow }>(token, `/api/crm/orders/from-proposal/${proposalId}`, {
    method: 'POST',
  });
}

export async function postInvoiceFromOrder(
  token: string,
  orderId: number,
  body?: { due_on?: string; issued_on?: string },
) {
  return crmFetch<{ invoice: InvoiceRow }>(token, `/api/crm/invoices/from-order/${orderId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export async function postInvoiceIssue(token: string, invoiceId: number, body?: { due_on?: string; issued_on?: string }) {
  return crmFetch<{ invoice: InvoiceRow }>(token, `/api/crm/invoices/${invoiceId}/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchOwnerWeeklyDashboard(
  token: string,
  params?: { year?: number; week?: number; trend_weeks?: number; week_end?: string },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.week != null) qs.set('week', String(params.week));
  if (params?.trend_weeks != null) qs.set('trend_weeks', String(params.trend_weeks));
  if (params?.week_end) qs.set('week_end', params.week_end);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/owner-weekly${suffix}`);
}

export async function fetchOwnerWeeklyConfig(token: string): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/owner-weekly/config');
}

export async function patchOwnerWeeklyConfig(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/owner-weekly/config', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchOwnerWeeklyCashSnapshots(
  token: string,
  params?: { limit?: number },
): Promise<Array<Record<string, unknown>>> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const out = await crmFetch<{ snapshots: Array<Record<string, unknown>> }>(
    token,
    `/api/crm/owner-weekly/cash-snapshots${suffix}`,
  );
  return out.snapshots ?? [];
}

export async function exportOwnerWeekly(
  token: string,
  params?: { year?: number; week?: number; week_end?: string },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.week != null) qs.set('week', String(params.week));
  if (params?.week_end) qs.set('week_end', params.week_end);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/owner-weekly/export${suffix}`);
}

export interface CrmBoardModuleCard {
  id: string;
  label: string;
  href: string;
  description: string;
}

export interface CrmBoardResponse {
  title: string;
  modules: CrmBoardModuleCard[];
  caps_count: number;
}

export async function fetchCrmBoard(token: string): Promise<CrmBoardResponse> {
  return crmFetch(token, '/api/crm/board');
}

export async function fetchSvcFinanceSummary(
  token: string,
  lifecycleId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/svc-finance/${lifecycleId}/summary`);
}

export async function createSvcPayment(
  token: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, '/api/crm/svc-payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchSvcPayment(
  token: string,
  paymentId: number,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/svc-payments/${paymentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteSvcPayment(token: string, paymentId: number): Promise<void> {
  await crmFetch(token, `/api/crm/svc-payments/${paymentId}`, { method: 'DELETE' });
}

export async function fetchCrmStaffList(
  token: string,
  params?: { q?: string },
): Promise<{ staff: CrmStaffRow[]; summary: Record<string, number> }> {
  const qs = params?.q ? `?q=${encodeURIComponent(params.q)}` : '';
  return crmFetch(token, `/api/crm/staff${qs}`);
}

export async function patchCrmStaff(
  token: string,
  staffId: number,
  body: Partial<{ name: string; phone: string; email: string; job_title: string }>,
): Promise<CrmStaffRow> {
  return crmFetch(token, `/api/crm/staff/${staffId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchCrmStaffWorkspace(
  token: string,
  staffId: number,
): Promise<Record<string, unknown>> {
  return crmFetch(token, `/api/crm/staff/${staffId}/workspace`);
}

export async function fetchKpiMetrics(token: string): Promise<KpiMetricRow[]> {
  const out = await crmFetch<{ metrics: KpiMetricRow[] }>(token, '/api/crm/kpi/metrics');
  return out.metrics ?? [];
}

export async function fetchStaffKpiAutoMetrics(
  token: string,
  staffId: number,
  params?: { role?: string; year?: number; month?: number },
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/staff-kpi/${staffId}/metrics${suffix}`);
}

export interface CatalogServiceRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  sort_order: number;
  active: boolean;
}

export interface CatalogIndustryRow {
  id: number;
  slug: string;
  name: string;
  description: string;
  traits: Record<string, unknown>;
  sort_order: number;
  active: boolean;
}

export interface AssignScopeRow {
  id: number;
  staff_id: number;
  industry_slug: string;
  service_slug: string;
  active: boolean;
  staff_name: string;
}

export interface CatalogStaffOption {
  id: number;
  name: string;
  internal_code: string;
}

export interface CatalogBundle {
  services: CatalogServiceRow[];
  industries: CatalogIndustryRow[];
  scopes: AssignScopeRow[];
  staff: CatalogStaffOption[];
}

async function catalogFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      ...(init?.headers ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Catalog request failed', res.status);
  }
  return body;
}

export async function fetchCatalogBundle(token: string): Promise<CatalogBundle> {
  const [pub, scopesPayload] = await Promise.all([
    catalogFetch<{ services: CatalogServiceRow[]; industries: CatalogIndustryRow[] }>(
      token,
      '/api/crm/catalog',
    ),
    catalogFetch<{ scopes: AssignScopeRow[]; staff: CatalogStaffOption[] }>(
      token,
      '/api/crm/assign-scopes',
    ),
  ]);
  return {
    services: pub.services ?? [],
    industries: pub.industries ?? [],
    scopes: scopesPayload.scopes ?? [],
    staff: scopesPayload.staff ?? [],
  };
}

export async function fetchCatalogIndustries(
  token: string,
): Promise<{ industries: CatalogIndustryRow[] }> {
  return catalogFetch(token, '/api/crm/catalog/industries');
}

export async function createCatalogService(
  token: string,
  body: { slug: string; name: string; description?: string; sort_order?: number },
): Promise<CatalogServiceRow> {
  const out = await catalogFetch<{ service: CatalogServiceRow }>(token, '/api/crm/catalog/services', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return out.service;
}

export async function patchCatalogService(
  token: string,
  id: number,
  body: { name?: string; active?: boolean; sort_order?: number },
): Promise<CatalogServiceRow> {
  const out = await catalogFetch<{ service: CatalogServiceRow }>(
    token,
    `/api/crm/catalog/services/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return out.service;
}

export async function createCatalogIndustry(
  token: string,
  body: { slug: string; name: string; description?: string; sort_order?: number },
): Promise<CatalogIndustryRow> {
  const out = await catalogFetch<{ industry: CatalogIndustryRow }>(
    token,
    '/api/crm/catalog/industries',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return out.industry;
}

export async function patchCatalogIndustry(
  token: string,
  id: number,
  body: { name?: string; active?: boolean; sort_order?: number },
): Promise<CatalogIndustryRow> {
  const out = await catalogFetch<{ industry: CatalogIndustryRow }>(
    token,
    `/api/crm/catalog/industries/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  return out.industry;
}

export async function createAssignScope(
  token: string,
  body: { staff_id: number; industry_slug?: string; service_slug?: string },
): Promise<AssignScopeRow> {
  const out = await catalogFetch<{ scope: AssignScopeRow }>(token, '/api/crm/assign-scopes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return out.scope;
}

export async function deleteAssignScope(token: string, id: number): Promise<void> {
  await catalogFetch<{ ok: boolean }>(token, `/api/crm/assign-scopes/${id}`, { method: 'DELETE' });
}

export async function fetchNestHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
  return parseJson(res);
}

export interface AgencyClient {
  id: string;
  code: string;
  name: string;
  industry_slug: string | null;
  status: string;
  tenant_locked?: boolean;
  owner_am_id: string | null;
  notes?: string | null;
  channels?: string;
  channel_accounts?: Array<{
    id: string;
    channel: string;
    external_account_id: string | null;
    display_name: string | null;
    status: string | null;
    has_token?: boolean;
    token_status?: string | null;
    token_expires_at?: string | null;
    facebook_page_id?: string | null;
    form_ids?: string[] | null;
  }>;
  side_effects?: {
    domain_event_id?: string | null;
    jobs_enqueued?: Array<{ id: string; job_type: string; status: string; created?: boolean }>;
    workflow_signal?: string;
  };
  created_at: string | null;
  updated_at: string | null;
}

export interface AgencyStats {
  pg_ready: boolean;
  clients: Record<string, number>;
  jobs: Record<string, number>;
}

export interface PerformanceRow {
  performance_date: string | null;
  external_campaign_name: string | null;
  external_campaign_id: string | null;
  spend: number;
  leads_crm: number;
  cpl: number | null;
  target_cpl_vnd: number | null;
  cpl_delta_pct: number | null;
  roas: number | null;
}

export interface PerformanceResponse {
  ok: boolean;
  rows: PerformanceRow[];
  summary: Record<string, unknown>;
}

import type {
  FacebookHubAlert,
  FacebookHubQuery,
  FacebookHubResponse,
} from '@/lib/meta/types';

export type {
  FacebookHubAlert,
  FacebookHubCampaignRow,
  FacebookHubCampaignsResponse,
  FacebookHubClient,
  FacebookHubExportScope,
  FacebookHubQuery,
  FacebookHubResponse,
  HubAttributionMeta,
  MetaAlertRow,
  MetaAlertsListResponse,
  MetaBadgeVariant,
  MetaHubFilterState,
  MetaHubMapSuggestBody,
  MetaHubMapSuggestResponse,
  MetaHubTab,
  MetaSyncStatusResponse,
} from '@/lib/meta/types';

export interface FacebookAdsMigrationStatus {
  ok: boolean;
  flask_meta_ads_admin_retired: boolean;
  ops_web_hub_url: string;
  ops_web_hub_path?: string;
  legacy_rs_path?: string;
  canonical_upstream: string;
  webhooks_nest_meta?: boolean;
  webhooks_flask_fallback?: boolean;
  horizon1_expect_meta_hub_retired?: boolean;
  gate_m1_g09: boolean;
  gate_m1_g06?: boolean;
  gate_m1_g06_config?: boolean;
  gate_m1_g06_live?: boolean | null;
  nginx_redirect_live_skipped?: boolean;
  nginx_deploy_config_ok?: boolean;
  gate_m1_g11?: boolean;
  retirement_dry_run_ok?: boolean | null;
  retirement_dry_run_artifact_present?: boolean;
  retirement_env_pending_changes?: number | null;
  retirement_env_already_applied?: boolean | null;
  retirement_next_apply_command?: string;
  gate_m1_g12?: boolean;
  retirement_applied_ok?: boolean | null;
  retirement_env_applied_ok?: boolean | null;
  retirement_apply_artifact_present?: boolean;
  gate_m1_g07?: boolean;
  autosync_standalone_ok?: boolean;
  autosync_unit_present?: boolean;
  autosync_daemon_present?: boolean;
  autosync_gunicorn_background_off?: boolean;
  autosync_unit_no_ptt_dependency?: boolean;
  gate_m1_g08?: boolean;
  soak_7d_ok?: boolean;
  soak_span_days?: number | null;
  soak_sample_count?: number;
  soak_required_days?: number;
  soak_min_samples?: number;
  soak_failure_count?: number;
  soak_latest_recorded_at?: string | null;
  soak_error?: string | null;
  manual_uat?: MetaMigrationManualUat;
  manual_uat_updated_at?: string | null;
  signoff_path?: string;
  ops_web_migration_url?: string;
}

export type MetaMigrationManualUatField =
  | 'ops_web_hub_cpl_summary'
  | 'webhook_test_lead_created'
  | 'autosync_single_process'
  | 'portal_meta_readonly'
  | 'campaign_write_approve_smoke';

export type MetaMigrationManualUat = Record<MetaMigrationManualUatField, boolean>;

export interface MetaMigrationSignoffResponse {
  ok: boolean;
  path: string;
  manual_uat: MetaMigrationManualUat;
  updated_at: string | null;
  signed_at: string | null;
  created_from_template?: boolean;
}

export interface HubMapRow {
  map_id?: string;
  hub_campaign_id: number | null;
  channel: string;
  external_campaign_id: string | null;
  external_campaign_name: string | null;
  external_account_id?: string | null;
  target_cpl_vnd: number | null;
  active: boolean;
  client_id?: string;
  client_code?: string | null;
  client_name?: string | null;
}

export interface HubMapCreateBody {
  channel?: string;
  external_campaign_id: string;
  external_campaign_name?: string;
  external_account_id?: string;
  target_cpl_vnd?: number;
}

export interface HubMapUpdateBody {
  external_campaign_id?: string;
  external_campaign_name?: string | null;
  external_account_id?: string | null;
  target_cpl_vnd?: number | null;
  active?: boolean;
}

async function agencyFetch<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Agency API failed', res.status);
  }
  return body;
}

async function agencyMutate<T>(
  token: string,
  path: string,
  init: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...authHeaders(token),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Agency API failed', res.status);
  }
  return body;
}

export async function fetchAgencyStats(token: string): Promise<AgencyStats> {
  return agencyFetch(token, '/api/v1/agency/stats');
}

export async function fetchAgencyClients(
  token: string,
  params?: { q?: string; status?: string },
): Promise<{ clients: AgencyClient[] }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/clients${suffix}`);
}

export async function fetchAgencyClient(token: string, id: string): Promise<AgencyClient> {
  return agencyFetch(token, `/api/v1/clients/${id}`);
}

export async function fetchClientPerformance(
  token: string,
  clientId: string,
  params?: { from?: string; to?: string; group_by?: string },
): Promise<PerformanceResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.group_by) qs.set('group_by', params.group_by);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/clients/${clientId}/performance${suffix}`);
}

export async function fetchFacebookAdsMigrationStatus(
  token: string,
): Promise<FacebookAdsMigrationStatus> {
  return agencyFetch(token, '/api/v1/facebook-ads/migration-status');
}

export async function fetchFacebookAdsMigrationSignoff(
  token: string,
): Promise<MetaMigrationSignoffResponse> {
  return agencyFetch(token, '/api/v1/facebook-ads/migration-signoff');
}

export async function patchFacebookAdsMigrationManualUat(
  token: string,
  updates: Partial<MetaMigrationManualUat>,
): Promise<{ ok: boolean; manual_uat: MetaMigrationManualUat; updated_at: string; path: string }> {
  return agencyMutate(token, '/api/v1/facebook-ads/migration-signoff/manual-uat', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function fetchFacebookHub(
  token: string,
  params: FacebookHubQuery = {},
): Promise<FacebookHubResponse> {
  const qs = new URLSearchParams();
  if (params.days != null) qs.set('days', String(params.days));
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.status) qs.set('status', params.status);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/facebook-ads/hub${suffix}`);
}

export {
  fetchFacebookHubCampaigns,
  fetchMetaAlerts,
  fetchMetaSyncStatus,
  patchMetaAlertAck,
  postMetaHubMapSuggest,
} from '@/lib/meta/api';

export { metaAlertsEnabled } from '@/lib/meta/flags';

export async function downloadFacebookHubExport(
  token: string,
  params: FacebookHubQuery & { scope?: 'clients' | 'campaigns' } = {},
): Promise<{ blob: Blob; filename: string }> {
  const qs = new URLSearchParams();
  if (params.days != null) qs.set('days', String(params.days));
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.status) qs.set('status', params.status);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.q) qs.set('q', params.q);
  if (params.scope) qs.set('scope', params.scope);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/facebook-ads/hub/export${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Export failed (${res.status})`);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? 'meta-hub-export.csv';
  const blob = await res.blob();
  return { blob, filename };
}

export interface GoogleHubClient {
  id: string;
  code: string | null;
  name: string | null;
  status: string | null;
  spend: number;
  leads_crm: number;
  cpl: number | null;
  campaigns: number;
  unmapped_campaigns: number;
  over_target_rows: number;
  google_account_count?: number;
  google_has_token?: boolean;
  token_status?: string;
}

export interface GoogleHubResponse {
  ok: boolean;
  summary: Record<string, unknown>;
  clients: GoogleHubClient[];
  alerts: FacebookHubAlert[];
  date_from: string;
  date_to: string;
  window_days?: number;
  pilot?: Record<string, unknown>;
  filters?: {
    client_id?: string | null;
    status?: string | null;
    q?: string | null;
  };
}

export type GoogleHubQuery = FacebookHubQuery;

export async function fetchGoogleHub(
  token: string,
  params: GoogleHubQuery = {},
): Promise<GoogleHubResponse> {
  const qs = new URLSearchParams();
  if (params.days != null) qs.set('days', String(params.days));
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.status) qs.set('status', params.status);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/google-ads/hub${suffix}`);
}

export async function downloadGoogleHubExport(
  token: string,
  params: GoogleHubQuery & { scope?: 'clients' | 'campaigns' } = {},
): Promise<{ blob: Blob; filename: string }> {
  const qs = new URLSearchParams();
  if (params.days != null) qs.set('days', String(params.days));
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.status) qs.set('status', params.status);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.q) qs.set('q', params.q);
  if (params.scope) qs.set('scope', params.scope);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/google-ads/hub/export${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Export failed (${res.status})`);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? 'google-hub-export.csv';
  const blob = await res.blob();
  return { blob, filename };
}

export async function fetchGoogleOAuthStartUrl(
  token: string,
  clientId: string,
  accountId?: string,
): Promise<{ ok: boolean; authorization_url: string; pilot?: Record<string, unknown> }> {
  const qs = new URLSearchParams({ client_id: clientId });
  if (accountId) qs.set('account_id', accountId);
  return agencyFetch(token, `/api/v1/google-ads/oauth/start?${qs.toString()}`);
}

export async function syncGoogleClientInsights(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; jobs_enqueued?: Array<{ id: string; job_type: string }>; pilot?: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/sync/google-insights`, {
    method: 'POST',
    body: '{}',
  });
}

export interface ZaloHubClient {
  id: string;
  code: string | null;
  name: string | null;
  status: string | null;
  spend: number;
  leads_crm: number;
  cpl: number | null;
  conversions_won?: number;
  conversion_value?: number;
  cpa?: number | null;
  campaigns: number;
  unmapped_campaigns: number;
  over_target_rows: number;
  zalo_account_count?: number;
  zalo_has_token?: boolean;
  token_status?: string;
}

export interface ZaloHubResponse {
  ok: boolean;
  summary: Record<string, unknown>;
  clients: ZaloHubClient[];
  alerts: FacebookHubAlert[];
  date_from: string;
  date_to: string;
  window_days?: number;
  pilot?: Record<string, unknown>;
  filters?: {
    client_id?: string | null;
    status?: string | null;
    q?: string | null;
  };
}

export type ZaloHubQuery = FacebookHubQuery;

export async function fetchZaloHub(
  token: string,
  params: ZaloHubQuery = {},
): Promise<ZaloHubResponse> {
  const qs = new URLSearchParams();
  if (params.days != null) qs.set('days', String(params.days));
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.status) qs.set('status', params.status);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.q) qs.set('q', params.q);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/zalo-ads/hub${suffix}`);
}

export interface ZaloLeadRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  channel: string | null;
  external_lead_id: string | null;
  form_id: string | null;
  oa_id: string | null;
  is_duplicate: boolean;
  created_at: string | null;
}

export interface ZaloLeadsResponse {
  ok: boolean;
  leads: ZaloLeadRow[];
  total: number;
}

export interface ZaloFormSyncRow {
  client_id: string;
  client_code: string | null;
  client_name: string | null;
  oa_id: string;
  form_id: string;
  channel_account_id: string;
  last_form_data_id: string | null;
  last_polled_at: string | null;
  last_status: string | null;
  last_error: string | null;
  has_token: boolean;
}

export interface ZaloFormsResponse {
  ok: boolean;
  forms: ZaloFormSyncRow[];
}

export async function fetchZaloLeads(
  token: string,
  params: { client_id?: string; form_id?: string; q?: string; limit?: number } = {},
): Promise<ZaloLeadsResponse> {
  const qs = new URLSearchParams();
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.form_id) qs.set('form_id', params.form_id);
  if (params.q) qs.set('q', params.q);
  if (params.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/zalo/leads${suffix}`);
}

export async function fetchZaloForms(token: string, clientId?: string): Promise<ZaloFormsResponse> {
  const qs = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return agencyFetch(token, `/api/v1/zalo/forms${qs}`);
}

export async function pollZaloForm(
  token: string,
  formId: string,
  params: { client_id?: string; force?: boolean } = {},
): Promise<{ ok: boolean; jobs_enqueued: Array<{ id: string; job_type: string; status: string }> }> {
  const qs = new URLSearchParams();
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.force) qs.set('force', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyMutate(token, `/api/v1/zalo/forms/${encodeURIComponent(formId)}/poll${suffix}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function downloadZaloHubExport(
  token: string,
  params: ZaloHubQuery & { scope?: 'clients' | 'campaigns'; format?: 'csv' | 'pdf' } = {},
): Promise<{ blob: Blob; filename: string }> {
  const qs = new URLSearchParams();
  if (params.days != null) qs.set('days', String(params.days));
  if (params.date_to) qs.set('date_to', params.date_to);
  if (params.date_from) qs.set('date_from', params.date_from);
  if (params.status) qs.set('status', params.status);
  if (params.client_id) qs.set('client_id', params.client_id);
  if (params.q) qs.set('q', params.q);
  if (params.scope) qs.set('scope', params.scope);
  if (params.format) qs.set('format', params.format);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/zalo-ads/hub/export${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Export failed (${res.status})`);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? 'zalo-hub-export.csv';
  const blob = await res.blob();
  return { blob, filename };
}

export async function fetchZaloOAuthStartUrl(
  token: string,
  clientId: string,
  accountId?: string,
): Promise<{ ok: boolean; authorization_url: string; pilot?: Record<string, unknown> }> {
  const qs = new URLSearchParams({ client_id: clientId });
  if (accountId) qs.set('account_id', accountId);
  return agencyFetch(token, `/api/v1/zalo-ads/oauth/start?${qs.toString()}`);
}

export async function syncZaloClientInsights(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; jobs_enqueued?: Array<{ id: string; job_type: string }>; pilot?: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/sync/zalo-insights`, {
    method: 'POST',
    body: '{}',
  });
}

export async function fetchHubCampaignMaps(
  token: string,
  params?: { client_id?: string; campaign_id?: string },
): Promise<{ ok: boolean; maps: HubMapRow[]; count: number }> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.campaign_id) qs.set('campaign_id', params.campaign_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/crm/hub-campaign-maps${suffix}`);
}

export interface JobRow {
  id: string;
  job_type: string;
  status: string;
  client_code: string | null;
  channel: string | null;
  last_error: string | null;
  created_at: string | null;
}

export async function fetchAgencyJobs(
  token: string,
  status?: string,
): Promise<{ stats: Record<string, number>; jobs: JobRow[] }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return agencyFetch(token, `/api/v1/jobs${qs}`);
}

export interface NotificationRow {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read: boolean;
  created_at: string | null;
}

export async function fetchAgencyNotifications(
  token: string,
): Promise<{ notifications: NotificationRow[]; unread: number }> {
  return agencyFetch(token, '/api/v1/notifications?limit=50');
}

export interface CreateClientBody {
  code: string;
  name: string;
  industry_slug?: string;
  owner_am_id?: string;
}

export async function createAgencyClient(
  token: string,
  body: CreateClientBody,
): Promise<AgencyClient> {
  return agencyMutate(token, '/api/v1/clients', { method: 'POST', body: JSON.stringify(body) });
}

export interface UpdateClientBody {
  name?: string;
  industry_slug?: string;
  owner_am_id?: string;
  notes?: string;
  status?: string;
}

export async function patchAgencyClient(
  token: string,
  clientId: string,
  body: UpdateClientBody,
): Promise<AgencyClient> {
  return agencyMutate(token, `/api/v1/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface OnboardingItem {
  id: string;
  item_key: string;
  label: string;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  note: string | null;
}

export interface OnboardingResponse {
  items: OnboardingItem[];
  progress: { total: number; completed: number; percent: number };
}

export interface OnboardingSummaryResponse extends OnboardingResponse {
  client_id: string;
  client_status: string;
  client_code: string;
  client_name: string;
  workflow: {
    workflow_id: string;
    status: string;
    run_id: string | null;
    found: boolean;
    temporal_enabled: boolean;
  };
  strict_onboarding: boolean;
  activation_ready: boolean;
  linked_lifecycles: Array<{
    lifecycle_id: number;
    stage: string;
    status: string;
    service_slug: string;
    contract_id: number;
    contract_title: string;
    service_delivery_url: string;
  }>;
}

export async function fetchClientOnboardingSummary(
  token: string,
  clientId: string,
): Promise<OnboardingSummaryResponse> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/onboarding/summary`);
}

export async function postClientOnboardingNudge(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; temporal_signal?: string }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/onboarding/nudge`, { method: 'POST', body: '{}' });
}

export async function postClientOnboardingStartWorkflow(
  token: string,
  clientId: string,
  body?: { started_by?: string },
): Promise<{ ok: boolean; workflow_started?: boolean }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/onboarding/start-workflow`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function fetchClientOnboarding(
  token: string,
  clientId: string,
): Promise<OnboardingResponse> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/onboarding`);
}

export async function patchClientOnboardingItem(
  token: string,
  clientId: string,
  itemKey: string,
  body: { completed: boolean; completed_by?: string; note?: string },
): Promise<OnboardingResponse> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/onboarding/${encodeURIComponent(itemKey)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface OnboardOrchestratorStep {
  key: string;
  label: string;
  module: string;
  sort_order: number;
  status: 'pending' | 'done' | 'skipped' | 'optional';
  href: string | null;
  auto_detected: boolean;
  manual_only: boolean;
  optional: boolean;
  checklist_item_key: string | null;
  hint: string | null;
  detection_detail: string | null;
}

export interface OnboardOrchestratorResponse {
  client_id: string;
  client_code: string;
  client_name: string;
  client_status: string;
  steps: OnboardOrchestratorStep[];
  progress: {
    total: number;
    completed: number;
    percent: number;
    required_total: number;
    required_completed: number;
    required_percent: number;
  };
  checklist_progress: {
    total: number;
    completed: number;
    percent: number;
    required_total: number;
    required_completed: number;
    required_percent: number;
  };
  linked_lifecycle_url: string | null;
  synced_at: string | null;
}

export async function fetchClientOnboardingOrchestrator(
  token: string,
  clientId: string,
): Promise<OnboardOrchestratorResponse> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/onboarding/orchestrator`);
}

export async function syncClientOnboardingOrchestrator(
  token: string,
  clientId: string,
): Promise<{ client_id: string; synced_items: string[]; orchestrator: OnboardOrchestratorResponse }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/onboarding/orchestrator/sync`, {
    method: 'POST',
    body: '{}',
  });
}

export async function activateAgencyClient(
  token: string,
  clientId: string,
  force = false,
): Promise<AgencyClient> {
  const qs = force ? '?force=1' : '';
  return agencyMutate(token, `/api/v1/clients/${clientId}/activate${qs}`, { method: 'POST', body: '{}' });
}

export interface ClientOffboardAuditRow {
  id: string;
  client_id: string;
  initiated_by: string;
  reason: string;
  note?: string | null;
  tokens_revoked: number;
  portal_users_deactivated: number;
  previous_status: string | null;
  created_at: string;
}

export interface OffboardClientResult {
  ok: boolean;
  client_id: string;
  status: string;
  tenant_locked: boolean;
  tokens_revoked: number;
  portal_users_deactivated: number;
  event_id: string | null;
  audit_id: string;
  idempotent?: boolean;
  follow_up?: {
    jobs_cancelled: number;
    workflow_cancelled: boolean;
  };
}

export async function offboardAgencyClient(
  token: string,
  clientId: string,
  body: { reason?: string; note?: string; archive_data?: boolean },
): Promise<OffboardClientResult> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/offboard`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchClientOffboardAudit(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; client_id: string; rows: ClientOffboardAuditRow[] }> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/offboard/audit`);
}

export type PortalClientRole = 'viewer' | 'approver';

export interface PortalClientUser {
  id: string;
  email: string;
  role: PortalClientRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalClientUsersListResult {
  ok: boolean;
  client_id: string;
  users: PortalClientUser[];
  table_ready: boolean;
}

export async function fetchClientPortalUsers(
  token: string,
  clientId: string,
): Promise<PortalClientUsersListResult> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/portal-users`);
}

export async function createClientPortalUser(
  token: string,
  clientId: string,
  body: { email: string; password?: string; role?: PortalClientRole; send_email?: boolean },
): Promise<{
  ok: boolean;
  user: PortalClientUser;
  temporary_password?: string;
  email_delivery?: { ok: boolean; skipped?: boolean; error?: string };
}> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/portal-users`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchClientPortalUser(
  token: string,
  clientId: string,
  userId: string,
  body: { role?: PortalClientRole; active?: boolean },
): Promise<PortalClientUser> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/portal-users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function resetClientPortalUserPassword(
  token: string,
  clientId: string,
  userId: string,
  body: { password?: string; send_email?: boolean } = {},
): Promise<{
  ok: boolean;
  temporary_password?: string;
  email_delivery?: { ok: boolean; skipped?: boolean; error?: string };
}> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/portal-users/${userId}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function addClientChannelAccount(
  token: string,
  clientId: string,
  body: { channel: string; external_account_id: string; display_name?: string; facebook_page_id?: string; form_ids?: string },
): Promise<AgencyClient> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/channel-accounts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchClientChannelAccount(
  token: string,
  clientId: string,
  accountId: string,
  body: { display_name?: string; external_account_id?: string; status?: string; facebook_page_id?: string; form_ids?: string },
): Promise<AgencyClient> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/channel-accounts/${accountId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteClientChannelAccount(
  token: string,
  clientId: string,
  accountId: string,
): Promise<{ ok: boolean }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/channel-accounts/${accountId}`, {
    method: 'DELETE',
    body: '{}',
  });
}

export async function setClientChannelToken(
  token: string,
  clientId: string,
  accountId: string,
  body: { access_token?: string; credential_ref?: string; token_expires_at?: string; revoke?: boolean },
): Promise<AgencyClient> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/channel-accounts/${accountId}/token`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function syncClientInsights(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; jobs_enqueued?: NonNullable<AgencyClient['side_effects']>['jobs_enqueued'] }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/sync/insights`, {
    method: 'POST',
    body: '{}',
  });
}

export interface ClientLeadSummary {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  status: string | null;
  channel: string | null;
  created_at: string | null;
}

export async function fetchClientLeads(
  token: string,
  clientId: string,
): Promise<{ leads: ClientLeadSummary[] }> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/leads`);
}

export async function fetchOnboardingWorkflowStatus(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; status?: string; workflow_id?: string }> {
  return agencyFetch(token, `/api/v1/clients/${clientId}/onboarding/workflow-status`);
}

export async function createKpiDefinition(
  token: string,
  body: { code: string; name: string; formula: string; granularity?: string; description?: string },
): Promise<{ definition: KpiDefinition }> {
  return agencyMutate(token, '/api/v1/kpi-definitions', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateKpiDefinition(
  token: string,
  code: string,
  body: { name?: string; formula?: string; granularity?: string; description?: string },
): Promise<{ ok: boolean }> {
  return agencyMutate(token, `/api/v1/kpi-definitions/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteKpiDefinition(token: string, code: string): Promise<{ ok: boolean }> {
  return agencyMutate(token, `/api/v1/kpi-definitions/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    body: '{}',
  });
}

export async function replayAgencyJob(
  token: string,
  jobId: string,
): Promise<{ id: string; status: string; replayed: boolean }> {
  return agencyMutate(token, `/api/v1/jobs/${jobId}/replay`, { method: 'POST', body: '{}' });
}

export async function markAgencyNotificationRead(
  token: string,
  notificationId: string,
  recipientId = 'ops',
): Promise<{ ok: boolean }> {
  const qs = recipientId ? `?recipient_id=${encodeURIComponent(recipientId)}` : '';
  return agencyMutate(token, `/api/v1/notifications/${notificationId}/read${qs}`, {
    method: 'PATCH',
    body: '{}',
  });
}

export async function markAllAgencyNotificationsRead(
  token: string,
  recipientId = 'ops',
): Promise<{ marked: number }> {
  const qs = recipientId ? `?recipient_id=${encodeURIComponent(recipientId)}` : '';
  return agencyMutate(token, `/api/v1/notifications/mark-all-read${qs}`, {
    method: 'POST',
    body: '{}',
  });
}

export interface KpiDefinition {
  code: string;
  name: string;
  formula: string;
  granularity: string | null;
  description: string | null;
}

export async function fetchKpiDefinitions(
  token: string,
): Promise<{ definitions: KpiDefinition[] }> {
  return agencyFetch(token, '/api/v1/kpi-definitions');
}

export async function fetchClientHubCampaignMaps(
  token: string,
  clientId: string,
  params?: { include_inactive?: boolean },
): Promise<{ ok: boolean; maps: HubMapRow[]; count: number; client_id: string }> {
  const qs = new URLSearchParams();
  if (params?.include_inactive) qs.set('include_inactive', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/clients/${clientId}/hub-campaign-maps${suffix}`);
}

export async function createClientHubCampaignMap(
  token: string,
  clientId: string,
  body: HubMapCreateBody,
): Promise<{ ok: boolean; map: HubMapRow; jobs_enqueued?: Array<{ id: string; job_type: string }> }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/hub-campaign-maps`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createHubCampaignMap(
  token: string,
  body: HubMapCreateBody & { client_id: string },
): Promise<{ ok: boolean; map: HubMapRow; jobs_enqueued?: Array<{ id: string; job_type: string }> }> {
  return agencyMutate(token, '/api/v1/crm/hub-campaign-maps', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateHubCampaignMap(
  token: string,
  mapId: string,
  body: HubMapUpdateBody,
  clientId?: string,
): Promise<{ ok: boolean; map: HubMapRow; jobs_enqueued?: Array<{ id: string; job_type: string }> }> {
  const qs = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return agencyMutate(token, `/api/v1/crm/hub-campaign-maps/${mapId}${qs}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function updateClientHubCampaignMap(
  token: string,
  clientId: string,
  mapId: string,
  body: HubMapUpdateBody,
): Promise<{ ok: boolean; map: HubMapRow; jobs_enqueued?: Array<{ id: string; job_type: string }> }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/hub-campaign-maps/${mapId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteHubCampaignMap(
  token: string,
  mapId: string,
  clientId?: string,
): Promise<{ ok: boolean }> {
  const qs = clientId ? `?client_id=${encodeURIComponent(clientId)}` : '';
  return agencyMutate(token, `/api/v1/crm/hub-campaign-maps/${mapId}${qs}`, {
    method: 'DELETE',
  });
}

export async function deleteClientHubCampaignMap(
  token: string,
  clientId: string,
  mapId: string,
): Promise<{ ok: boolean }> {
  return agencyMutate(token, `/api/v1/clients/${clientId}/hub-campaign-maps/${mapId}`, {
    method: 'DELETE',
  });
}

export interface SeoHubClientRow {
  customer_id: number;
  customer_name: string;
  customer_company: string;
  settings_ok: boolean;
  domains: string[];
  markets: string[];
  contract_tier: string;
  active_projects: number;
  active_initiatives: number;
  aeo_queries: number;
  aeo_visible: number;
  aeo_coverage_pct: number;
  critical_issues: number;
  content_overdue: number;
  health_score: number;
  health_tier: 'good' | 'warn' | 'bad';
}

export interface SeoHubAlert {
  severity: 'warn' | 'danger';
  message: string;
  link: string;
  link_label: string;
}

export interface SeoHubResponse {
  ok: boolean;
  summary: {
    seo_clients: number;
    active_lifecycles: number;
    aeo_queries_total: number;
    aeo_visible_total: number;
    aeo_coverage_pct: number;
    settings_missing: number;
    active_initiatives: number;
    critical_issues: number;
    open_alerts: number;
    failed_sync_runs: number;
    organic_growth_pct: number;
    publish_sla_pct: number;
  };
  clients: SeoHubClientRow[];
  alerts: SeoHubAlert[];
  executive: {
    gsc_totals: Record<string, unknown>;
    gsc_trend?: Array<{ date: string; clicks: number; impressions: number }>;
    content_delivery: Record<string, number>;
    critical_issues?: Array<{
      id: number;
      customer_id: number;
      url: string;
      issue_type: string;
      severity: string;
      status: string;
      customer_name: string;
    }>;
  };
}

export async function fetchSeoHub(
  token: string,
  params?: { customer_id?: number; days?: number; market?: string },
): Promise<SeoHubResponse> {
  const qs = new URLSearchParams();
  if (params?.customer_id != null) qs.set('customer_id', String(params.customer_id));
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.market) qs.set('market', params.market);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/seo/hub${suffix}`);
}

export async function fetchSeoClients(
  token: string,
  params?: { customer_id?: number; market?: string },
): Promise<{ ok: boolean; clients: SeoHubClientRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.customer_id != null) qs.set('customer_id', String(params.customer_id));
  if (params?.market) qs.set('market', params.market);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/seo/clients${suffix}`);
}

export interface SeoClientSettings {
  customer_id: number;
  domains: string[];
  markets: string[];
  languages: string[];
  industry: string;
  brand_guidelines: Record<string, unknown>;
  seo_guidelines: Record<string, unknown>;
  aeo_guidelines: Record<string, unknown>;
  contract_tier: string;
  notes: string;
  integrations: Record<string, unknown>;
  updated_at: string | null;
}

export interface SeoClientWorkspaceResponse {
  ok: boolean;
  client: SeoHubClientRow;
  settings: SeoClientSettings;
  integrations: {
    gsc: { connected: boolean; site_url?: string; status: string; last_sync_at?: string | null };
    ga4: { connected: boolean; property_id?: string; status: string; last_sync_at?: string | null };
  };
  sync_runs: Array<{
    id: number;
    source: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    rows_imported: number;
    error_message: string;
  }>;
  gsc_totals: Record<string, unknown>;
  content_delivery: Record<string, number>;
}

export interface SeoClientTasksResponse {
  ok: boolean;
  customer_id: number;
  service_tasks: Array<{
    kind: 'service';
    task_id: number;
    lifecycle_id: number;
    service_slug: string;
    stage: string;
    title: string;
    due_on: string;
    url: string;
  }>;
  technical_issues: Array<{
    kind: 'technical';
    issue_id: number;
    title: string;
    severity: string;
    status: string;
    url: string;
  }>;
  open_count: number;
}

export async function fetchSeoClientWorkspace(
  token: string,
  customerId: number,
): Promise<SeoClientWorkspaceResponse> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}`);
}

export async function fetchSeoClientTasks(
  token: string,
  customerId: number,
): Promise<SeoClientTasksResponse> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/tasks`);
}

export async function updateSeoClientSettings(
  token: string,
  customerId: number,
  body: {
    domains?: string[];
    markets?: string[];
    languages?: string[];
    industry?: string;
    contract_tier?: string;
    notes?: string;
  },
): Promise<{ ok: boolean; settings: SeoClientSettings }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function triggerSeoClientSync(
  token: string,
  customerId: number,
  source: 'gsc' | 'ga4',
): Promise<{ ok: boolean; mode: string; job_id?: string | null; error?: string }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/sync/${source}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchSeoGscOAuthUrl(
  token: string,
  customerId: number,
  siteUrl?: string,
): Promise<{ ok: boolean; authorization_url: string }> {
  const qs = siteUrl ? `?site_url=${encodeURIComponent(siteUrl)}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/gsc/oauth/url${qs}`);
}

export async function fetchSeoGa4OAuthUrl(
  token: string,
  customerId: number,
  propertyId?: string,
): Promise<{ ok: boolean; authorization_url: string }> {
  const qs = propertyId ? `?property_id=${encodeURIComponent(propertyId)}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/ga4/oauth/url${qs}`);
}

export interface SeoKeywordRow {
  id: number;
  customer_id: number;
  phrase: string;
  volume: number | null;
  difficulty: number | null;
  intent: string;
  business_value: string;
  cluster_id: number | null;
  opportunity_score: number | null;
  status: string;
  created_at: string | null;
  cluster_name?: string | null;
}

export interface SeoQuestionRow {
  id: number;
  customer_id: number;
  question_text: string;
  intent: string;
  funnel_stage: string;
  source: string;
  answer_score: number | null;
  status: string;
  brand_name: string;
  lifecycle_id: number | null;
  notes: string;
  created_at: string | null;
}

export interface SeoEntityGroupRow {
  entity_key: string;
  label: string;
  intent: string;
  keyword_count: number;
  avg_opportunity_score: number;
  top_opportunity_score: number;
  sample_keywords: Array<{ phrase: string; opportunity_score: number | null }>;
}

export interface SeoClusterRow {
  id: number;
  customer_id: number;
  name: string;
  intent: string;
  notes: string;
  status: string;
  keyword_count: number;
}

export interface SeoContentRow {
  id: number;
  customer_id: number;
  project_id: number | null;
  lifecycle_id: number | null;
  title: string;
  slug: string;
  content_type: string;
  workflow_status: string;
  target_keyword_id: number | null;
  target_question_id: number | null;
  intent: string;
  funnel_stage: string;
  owner_staff_id: number | null;
  due_date: string | null;
  publish_date: string | null;
  brief: Record<string, unknown>;
  outline: Record<string, unknown>;
  body_html: string;
  seo_score: number | null;
  aeo_score: number | null;
  created_at: string | null;
  updated_at: string | null;
  target_keyword?: SeoKeywordRow | null;
  target_question?: SeoQuestionRow | null;
  approvals?: Array<{
    stage: string;
    status: string;
    notes: string;
    actor_id: string;
    created_at: string | null;
  }>;
}

export interface SeoPipelineBoard {
  columns: Array<{ key: string; label: string; items: SeoContentRow[] }>;
}

export interface SeoBriefPreviewResponse {
  ok: boolean;
  title: string;
  brief: Record<string, unknown>;
  source: string;
  keyword_id?: number | null;
  question_id?: number | null;
  ai_available: boolean;
}

export interface SeoResearchConsoleResponse {
  ok: boolean;
  customer_id: number;
  keywords: SeoKeywordRow[];
  questions: SeoQuestionRow[];
  entities: SeoEntityGroupRow[];
  opportunities: SeoKeywordRow[];
  clusters: SeoClusterRow[];
  serp_snapshots?: SeoSerpSnapshotRow[];
  pages?: SeoPageRow[];
}

export interface SeoSerpSnapshotRow {
  id: number;
  customer_id: number;
  keyword_id: number | null;
  phrase: string;
  snapshot_date: string;
  source: string;
  created_at: string;
  result_count: number;
  top_results: Array<Record<string, unknown>>;
}

export interface SeoPageRow {
  id: number;
  customer_id: number;
  url: string;
  title: string;
  slug: string;
  content_type: string;
  schema_type: string;
  status: string;
  last_crawled_at: string | null;
  created_at: string | null;
}

export interface SeoAeoChecklistResponse {
  content_id: number;
  items: Array<{ label: string; done: boolean }>;
  done_count: number;
  total: number;
  score_pct: number;
}

export async function fetchSeoResearchConsole(
  token: string,
  customerId: number,
  tab?: string,
): Promise<SeoResearchConsoleResponse> {
  const qs = tab ? `?tab=${encodeURIComponent(tab)}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/research${qs}`);
}

export async function fetchSeoKeywords(
  token: string,
  customerId: number,
  params?: { q?: string; intent?: string; cluster_id?: number },
): Promise<{ ok: boolean; keywords: SeoKeywordRow[] }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.intent) qs.set('intent', params.intent);
  if (params?.cluster_id != null) qs.set('cluster_id', String(params.cluster_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/keywords${suffix}`);
}

export async function createSeoKeyword(
  token: string,
  customerId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; keyword: SeoKeywordRow }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/keywords`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function importSeoKeywordsCsv(
  token: string,
  customerId: number,
  csv: string,
): Promise<{ ok: boolean; imported: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/keywords/import`, {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export async function createSeoQuestion(
  token: string,
  customerId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; question: SeoQuestionRow }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/questions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createSeoCluster(
  token: string,
  customerId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; cluster: SeoClusterRow }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/clusters`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function captureSeoSerpSnapshot(
  token: string,
  customerId: number,
  body: { phrase: string; keyword_id?: number; domain_hint?: string },
): Promise<{ ok: boolean; snapshot: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/research/serp`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function syncSeoPagesFromGsc(
  token: string,
  customerId: number,
  days = 90,
): Promise<{ ok: boolean; synced: number; source: string }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/research/pages/sync-gsc`, {
    method: 'POST',
    body: JSON.stringify({ days }),
  });
}

export async function autolinkSeoEntities(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; entities_created: number; links_created: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/entities/autolink`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function previewSeoBrief(
  token: string,
  body: { customer_id: number; keyword_id?: number; question_id?: number },
): Promise<SeoBriefPreviewResponse> {
  return agencyMutate(token, '/api/v1/seo/research/brief-preview', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createSeoContentFromResearch(
  token: string,
  body: {
    customer_id: number;
    keyword_id?: number;
    question_id?: number;
    lifecycle_id?: number;
    project_id?: number;
    title?: string;
    brief?: Record<string, unknown>;
    owner_staff_id?: number;
    due_date?: string;
  },
): Promise<{ ok: boolean; content: SeoContentRow }> {
  return agencyMutate(token, '/api/v1/seo/research/to-content', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoContentPipeline(
  token: string,
  params?: { customer_id?: number; lifecycle_id?: number },
): Promise<{ ok: boolean; board: SeoPipelineBoard }> {
  const qs = new URLSearchParams();
  if (params?.customer_id != null) qs.set('customer_id', String(params.customer_id));
  if (params?.lifecycle_id != null) qs.set('lifecycle_id', String(params.lifecycle_id));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/seo/content/pipeline${suffix}`);
}

export async function fetchSeoContentDetail(
  token: string,
  contentId: number,
): Promise<{ ok: boolean; content: SeoContentRow }> {
  return agencyFetch(token, `/api/v1/seo/content/${contentId}`);
}

export async function updateSeoContentStatus(
  token: string,
  contentId: number,
  body: { workflow_status: string; notes?: string },
): Promise<{ ok: boolean; content: SeoContentRow }> {
  return agencyMutate(token, `/api/v1/seo/content/${contentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function approveSeoContent(
  token: string,
  contentId: number,
  body: { stage: string; approved: boolean; notes?: string },
): Promise<{ ok: boolean; content: SeoContentRow }> {
  return agencyMutate(token, `/api/v1/seo/content/${contentId}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoContentVersions(
  token: string,
  contentId: number,
): Promise<{ ok: boolean; versions: Array<{ id: number; version_number: number; changes_summary: string; created_by: string; created_at: string | null; body_length?: number }> }> {
  return agencyFetch(token, `/api/v1/seo/content/${contentId}/versions`);
}

export async function saveSeoContentVersion(
  token: string,
  contentId: number,
  body: { body_html: string; changes_summary?: string },
): Promise<{ ok: boolean; version: { id: number; version_number: number } }> {
  return agencyMutate(token, `/api/v1/seo/content/${contentId}/versions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoAeoChecklist(
  token: string,
  contentId: number,
): Promise<{ ok: boolean; checklist: SeoAeoChecklistResponse }> {
  return agencyFetch(token, `/api/v1/seo/content/${contentId}/aeo-checklist`);
}

export async function patchSeoContent(
  token: string,
  contentId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; content: SeoContentRow }> {
  return agencyMutate(token, `/api/v1/seo/content/${contentId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface SeoTechnicalIssueRow {
  id: number;
  customer_id: number;
  url: string;
  issue_type: string;
  severity: string;
  status: string;
  description: string;
  impact_notes: string;
  assignee_id: number | null;
  discovered_at: string | null;
  resolved_at: string | null;
}

export interface SeoDashboardData {
  type: string;
  customer_id: number | null;
  days?: number;
  gsc?: Record<string, unknown>;
  gsc_trend?: Array<{ stat_date: string; clicks: number; impressions: number }>;
  content_by_status?: Record<string, number>;
  content_chart?: Array<{ label: string; value: number }>;
  severity?: Record<string, number>;
  severity_chart?: Array<{ label: string; value: number }>;
  issues?: Array<Record<string, unknown>>;
  critical_issues?: number;
  aeo?: Record<string, unknown>;
  open_alerts?: number;
}

export async function fetchSeoTechnicalIssues(
  token: string,
  customerId: number,
  params?: { severity?: string; status?: string },
): Promise<{ ok: boolean; issues: SeoTechnicalIssueRow[]; severity_matrix: Record<string, number> }> {
  const qs = new URLSearchParams();
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/issues${suffix}`);
}

export async function importSeoTechnicalCsv(
  token: string,
  customerId: number,
  csv: string,
): Promise<{ ok: boolean; imported: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/issues/import`, {
    method: 'POST',
    body: JSON.stringify({ csv }),
  });
}

export async function patchSeoTechnicalIssue(
  token: string,
  issueId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; issue: SeoTechnicalIssueRow }> {
  return agencyMutate(token, `/api/v1/seo/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoCwv(
  token: string,
  customerId: number,
): Promise<{
  ok: boolean;
  summary: Record<string, unknown>;
  snapshots: Array<Record<string, unknown>>;
}> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/cwv`);
}

export async function captureSeoCwv(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; captured: number; errors: string[] }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/cwv/capture`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchSeoDashboard(
  token: string,
  customerId: number,
  type: string,
): Promise<{ ok: boolean; dashboard: SeoDashboardData }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/dashboard/${type}`);
}

export async function fetchSeoGovernancePolicies(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; policies: Array<Record<string, unknown>> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/governance/policies`);
}

export async function fetchSeoGovernanceCompliance(
  token: string,
  customerId?: number,
  days = 7,
): Promise<{ ok: boolean; summary: Record<string, unknown> }> {
  const qs = new URLSearchParams({ days: String(days) });
  if (customerId != null) qs.set('customer_id', String(customerId));
  return agencyFetch(token, `/api/v1/seo/governance/compliance?${qs.toString()}`);
}

export async function fetchSeoOkrTree(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; goals: Array<Record<string, unknown>>; unlinked_initiatives: Array<Record<string, unknown>> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/strategy/okr`);
}

export async function refreshSeoStrategyKpis(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; updated: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/strategy/kpis/refresh`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export interface SeoAeoQueryRow {
  id: number;
  customer_id: number;
  query_text: string;
  brand_name: string;
  brand_visible: boolean;
  citation_status: string;
  last_scan_date: string | null;
}

export async function fetchSeoAeoConsole(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; queries: SeoAeoQueryRow[]; coverage: Record<string, unknown> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/aeo/queries`);
}

export async function createSeoAeoQuery(
  token: string,
  customerId: number,
  body: { query_text: string; brand_name: string; notes?: string },
): Promise<{ ok: boolean; query: SeoAeoQueryRow }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/aeo/queries`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function enqueueSeoAeoScan(
  token: string,
  customerId: number,
  queryIds?: number[],
): Promise<{ ok: boolean; mode: string; job?: unknown; outcome?: unknown }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/aeo/scan`, {
    method: 'POST',
    body: JSON.stringify({ query_ids: queryIds ?? [] }),
  });
}

export async function syncSeoAeoScan(
  token: string,
  customerId: number,
  queryIds?: number[],
): Promise<{ ok: boolean; outcome: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/aeo/scan/sync`, {
    method: 'POST',
    body: JSON.stringify({ query_ids: queryIds ?? [] }),
  });
}

export async function fetchSeoAuthoritySignals(
  token: string,
  customerId: number,
  params?: { signal_type?: string },
): Promise<{ ok: boolean; signals: Array<Record<string, unknown>>; summary: Record<string, unknown> }> {
  const qs = new URLSearchParams();
  if (params?.signal_type) qs.set('signal_type', params.signal_type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/authority/signals${suffix}`);
}

export async function importSeoAuthorityCsv(
  token: string,
  customerId: number,
  csvText: string,
  signalType = 'backlink',
): Promise<{ ok: boolean; imported: number; skipped: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/authority/import`, {
    method: 'POST',
    body: JSON.stringify({ csv_text: csvText, signal_type: signalType }),
  });
}

export async function fetchSeoRankKeywords(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; keywords: Array<Record<string, unknown>>; sov: Record<string, unknown> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/ranks/keywords`);
}

export async function addSeoRankKeyword(
  token: string,
  customerId: number,
  body: { phrase: string; target_url?: string },
): Promise<{ ok: boolean; keyword: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/ranks/keywords`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function captureSeoRanks(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; result: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/ranks/capture`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function importSeoRankCsv(
  token: string,
  customerId: number,
  csvText: string,
): Promise<{ ok: boolean; tracked_added: number; snapshots: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/ranks/import`, {
    method: 'POST',
    body: JSON.stringify({ csv_text: csvText }),
  });
}

export async function fetchSeoAutomationsStatus(
  token: string,
  customerId?: number,
): Promise<{ ok: boolean; summary: Record<string, unknown>; sync_runs: Array<Record<string, unknown>>; recent_jobs: Array<Record<string, unknown>>; open_alerts: Array<Record<string, unknown>> }> {
  const qs = customerId != null ? `?customer_id=${customerId}` : '';
  return agencyFetch(token, `/api/v1/seo/automations/status${qs}`);
}

export async function runSeoAutomationsAlertChecks(
  token: string,
): Promise<{ ok: boolean; created: Array<{ id: number; type: string }> }> {
  return agencyMutate(token, '/api/v1/seo/automations/run-alert-checks', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchSeoFreshnessQueue(
  token: string,
  customerId: number,
  minPriority?: string,
): Promise<{ ok: boolean; items: Array<Record<string, unknown>> }> {
  const qs = minPriority ? `?min_priority=${encodeURIComponent(minPriority)}` : '';
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/freshness/queue${qs}`);
}

export async function rescoreSeoFreshness(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; scored: number }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/freshness/rescore`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchSeoExperimentsStatus(
  token: string,
): Promise<{ ok: boolean; enabled: boolean }> {
  return agencyFetch(token, '/api/v1/seo/experiments/status');
}

export async function fetchSeoExperiments(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; experiments: Array<Record<string, unknown>> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/experiments`);
}

export async function createSeoExperiment(
  token: string,
  customerId: number,
  body: { title: string; hypothesis?: string; experiment_type?: string; target_url?: string },
): Promise<{ ok: boolean; experiment: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/experiments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoBiStatus(
  token: string,
): Promise<{ ok: boolean; clickhouse_configured: boolean; bi_export_enabled: boolean; cwv_stub: boolean; serp_provider: string; grafana_dashboard: string; gate_d_flags: Record<string, unknown>; gate_e_flags: Record<string, unknown> }> {
  return agencyFetch(token, '/api/v1/seo/bi/status');
}

export async function fetchSeoBiDashboard(
  token: string,
  customerId?: number,
  days = 28,
): Promise<{ type: string; gsc_series: Array<Record<string, unknown>>; totals: Record<string, number> }> {
  const params = new URLSearchParams({ days: String(days) });
  if (customerId != null) params.set('customer_id', String(customerId));
  return agencyFetch(token, `/api/v1/seo/bi/dashboard?${params}`);
}

export async function fetchSeoBiParity(
  token: string,
  days = 7,
): Promise<{ ok: boolean; metrics: string[]; sample_facts: Array<Record<string, unknown>>; totals_by_metric: Record<string, number> }> {
  return agencyFetch(token, `/api/v1/seo/bi/parity?days=${days}`);
}

export async function exportSeoClickhouse(
  token: string,
  factDate?: string,
): Promise<{ ok: boolean; job_id?: string; mode: string; error?: string }> {
  const qs = factDate ? `?fact_date=${encodeURIComponent(factDate)}` : '';
  return agencyMutate(token, `/api/v1/seo/bi/export-clickhouse${qs}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchSeoAttribution(
  token: string,
  customerId: number,
  days = 28,
): Promise<{ ok: boolean; summary: Record<string, unknown>; top_landing_pages: Array<Record<string, unknown>> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/attribution?days=${days}`);
}

export async function fetchSeoCrawlSchedule(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; schedule: Record<string, unknown> | null }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/crawl-schedule`);
}

export async function upsertSeoCrawlSchedule(
  token: string,
  customerId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; schedule: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/crawl-schedule`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoCmsTarget(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; target: Record<string, unknown> | null }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/cms-target`);
}

export async function upsertSeoCmsTarget(
  token: string,
  customerId: number,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; target: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/cms-target`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function fetchSeoCmsJobs(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; jobs: Array<Record<string, unknown>> }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/cms-jobs`);
}

export async function testSeoCmsWebhook(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; status: string; remote_url?: string; response?: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/cms/test`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function fetchSeoGateAStatus(
  token: string,
): Promise<Record<string, unknown>> {
  return agencyFetch(token, '/api/v1/seo/gate-a/status');
}

export async function fetchSeoGateAReadiness(
  token: string,
): Promise<Record<string, unknown>> {
  return agencyFetch(token, '/api/v1/seo/gate-a/readiness');
}

export async function fetchSeoGateASignoffTemplate(
  token: string,
): Promise<{ ok: boolean; template: Record<string, unknown> }> {
  return agencyFetch(token, '/api/v1/seo/gate-a/signoff-template');
}

export async function fetchEmailGateAStatus(
  token: string,
): Promise<Record<string, unknown>> {
  return agencyFetch(token, '/api/v1/email/gate-a/status');
}

export async function fetchEmailGateAReadiness(
  token: string,
): Promise<Record<string, unknown>> {
  return agencyFetch(token, '/api/v1/email/gate-a/readiness');
}

export async function fetchEmailGateASignoffTemplate(
  token: string,
): Promise<{ ok: boolean; template: Record<string, unknown> }> {
  return agencyFetch(token, '/api/v1/email/gate-a/signoff-template');
}

export async function fetchSeoAlerts(
  token: string,
  status = 'open',
): Promise<{ ok: boolean; alerts: Array<Record<string, unknown>> }> {
  return agencyFetch(token, `/api/v1/seo/alerts?status=${encodeURIComponent(status)}`);
}

export async function fetchSeoGovernanceStatus(
  token: string,
): Promise<{ ok: boolean; enabled: boolean }> {
  return agencyFetch(token, '/api/v1/seo/governance/status');
}

export interface SeoReportScheduleRow {
  id: number;
  customer_id: number;
  dashboard_type: string;
  cadence: string;
  day_of_week: number;
  day_of_month: number;
  recipient_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string | null;
}

export async function fetchSeoReportSchedules(
  token: string,
  customerId: number,
): Promise<{ ok: boolean; schedules: SeoReportScheduleRow[] }> {
  return agencyFetch(token, `/api/v1/seo/clients/${customerId}/reports/schedules`);
}

export async function createSeoStrategyGoal(
  token: string,
  customerId: number,
  body: { title: string; description?: string; period?: string; status?: string; sort_order?: number },
): Promise<{ ok: boolean; goal: { id: number; title: string } }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/strategy/goals`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createSeoStrategyKpi(
  token: string,
  customerId: number,
  body: {
    goal_id: number;
    metric_label: string;
    metric_key?: string;
    target_value?: number | string | null;
    current_value?: number | string | null;
    unit?: string;
    initiative_id?: number | null;
  },
): Promise<{ ok: boolean; kpi: { id: number; metric_label: string } }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/strategy/kpis`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateSeoStrategyKpi(
  token: string,
  customerId: number,
  kpiId: number,
  body: {
    goal_id?: number;
    metric_label?: string;
    metric_key?: string;
    target_value?: number | string | null;
    current_value?: number | string | null;
    unit?: string;
    initiative_id?: number | null;
  },
): Promise<{ ok: boolean; kpi: Record<string, unknown> }> {
  return agencyMutate(token, `/api/v1/seo/clients/${customerId}/strategy/kpis/${kpiId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function downloadSeoReportExport(
  token: string,
  customerId: number,
  params: { type?: string; format?: string; customer_label?: string } = {},
): Promise<{ blob: Blob; filename: string }> {
  const qs = new URLSearchParams();
  if (params.type) qs.set('type', params.type);
  if (params.format) qs.set('format', params.format);
  if (params.customer_label) qs.set('customer_label', params.customer_label);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/seo/clients/${customerId}/reports/export${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Export failed (${res.status})`);
  }
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(cd);
  const filename = match?.[1] ?? 'seo-report.csv';
  const blob = await res.blob();
  return { blob, filename };
}

export interface EmailHubSummary {
  workspaces: number;
  contacts: number;
  emails_sent: number;
  open_rate_pct: number;
  complaint_rate_pct: number;
  pending_approvals: number;
  send_queue_lag_minutes: number;
  revenue_attrib: number;
}

export interface EmailHubClientRow {
  client_id: string;
  client_code: string;
  client_name: string;
  workspace_name: string | null;
  primary_domain: string | null;
  domain_health: 'healthy' | 'at_risk' | 'unknown';
  complaint_rate_pct: number;
  last_send_at: string | null;
  pending_campaigns: number;
}

export interface EmailHubAlert {
  severity: 'info' | 'warn' | 'danger';
  message: string;
  link: string;
  link_label: string;
}

export interface EmailHubResponse {
  ok: boolean;
  schema_ready: boolean;
  summary: EmailHubSummary;
  clients: EmailHubClientRow[];
  pending_approvals: Array<{
    campaign_id: string;
    client_id: string;
    client_name: string;
    campaign_name: string;
    scheduled_at: string | null;
    audience_count: number | null;
  }>;
  send_calendar: Array<{
    campaign_id: string;
    client_name: string;
    campaign_name: string;
    scheduled_at: string;
    status: string;
  }>;
  alerts: EmailHubAlert[];
  filters: { client_id?: string | null; days: number; domain?: string | null };
}

export interface EmailGovernanceRule {
  id: string;
  scope: string;
  client_id: string | null;
  rule_type: string;
  config_json: Record<string, unknown>;
  priority: number;
  enabled: boolean;
  created_at: string;
}

export interface EmailGovernanceResponse {
  ok: boolean;
  read_only: boolean;
  can_write?: boolean;
  schema_ready: boolean;
  rules: EmailGovernanceRule[];
  audit_log: Array<{
    id: number;
    client_id: string | null;
    actor: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    before_json?: Record<string, unknown> | null;
    after_json?: Record<string, unknown> | null;
    created_at: string;
  }>;
  filters: { scope?: string | null };
}

export interface EmailBiStatus {
  ok: boolean;
  clickhouse_configured: boolean;
  bi_export_enabled: boolean;
  grafana_dashboard: string;
  grafana_url: string | null;
}

export async function fetchEmailHub(
  token: string,
  params?: { client_id?: string; days?: number; domain?: string },
): Promise<EmailHubResponse> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.domain) qs.set('domain', params.domain);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/hub${suffix}`);
}

export async function fetchEmailGovernance(
  token: string,
  params?: { scope?: string },
): Promise<EmailGovernanceResponse> {
  const qs = new URLSearchParams();
  if (params?.scope) qs.set('scope', params.scope);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/governance${suffix}`);
}

export async function createEmailGovernanceRule(
  token: string,
  body: {
    scope: string;
    client_id?: string | null;
    rule_type: string;
    config_json: Record<string, unknown>;
    priority?: number;
    enabled?: boolean;
  },
): Promise<{ ok: boolean; rule: EmailGovernanceRule }> {
  return agencyMutate(token, '/api/v1/email/governance/rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchEmailGovernanceRule(
  token: string,
  ruleId: string,
  body: { config_json?: Record<string, unknown>; priority?: number; enabled?: boolean },
): Promise<{ ok: boolean; rule: EmailGovernanceRule }> {
  return agencyMutate(token, `/api/v1/email/governance/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteEmailGovernanceRule(
  token: string,
  ruleId: string,
): Promise<{ ok: boolean }> {
  return agencyMutate(token, `/api/v1/email/governance/rules/${ruleId}`, { method: 'DELETE' });
}

export async function fetchEmailBiStatus(token: string): Promise<EmailBiStatus> {
  return agencyFetch(token, '/api/v1/email/reports/bi-status');
}

export interface EmailClientListRow {
  client_id: string;
  client_code: string;
  client_name: string;
  client_status: string;
  workspace_id: string | null;
  workspace_name: string | null;
  esp_provider: string | null;
  contact_count: number;
  has_workspace: boolean;
}

export interface EmailWorkspaceRow {
  id: string;
  client_id: string;
  client_code: string;
  client_name: string;
  name: string;
  default_from_name: string | null;
  default_from_email: string | null;
  default_reply_to: string | null;
  esp_provider: string;
  daily_send_cap: number;
  frequency_cap_7d: number;
  timezone: string;
  status: string;
  contact_count: number;
  subscriber_count: number;
  suppressed_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmailContactRow {
  id: string;
  client_id: string;
  client_name: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  lifecycle_stage: string | null;
  consent_status: string | null;
  suppressed: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailConsentRow {
  id: string;
  client_id: string;
  contact_id: string;
  contact_email: string;
  topic: string;
  status: string;
  source: string;
  consent_version: string | null;
  recorded_at: string;
  recorded_by: string | null;
}

export interface EmailSuppressionRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  email_normalized: string;
  reason: string;
  scope: string;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface EmailPaged<T> {
  ok: boolean;
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchEmailClients(
  token: string,
  params?: { q?: string; has_workspace?: boolean; limit?: number; offset?: number },
): Promise<EmailPaged<EmailClientListRow>> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.has_workspace != null) qs.set('has_workspace', params.has_workspace ? '1' : '0');
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/clients${suffix}`);
}

export async function fetchEmailWorkspaces(
  token: string,
  params?: { client_id?: string; limit?: number; offset?: number },
): Promise<EmailPaged<EmailWorkspaceRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/workspaces${suffix}`);
}

export async function createEmailWorkspace(
  token: string,
  body: {
    client_id: string;
    name?: string;
    default_from_name?: string;
    default_from_email?: string;
    default_reply_to?: string;
    esp_provider?: string;
    daily_send_cap?: number;
    frequency_cap_7d?: number;
    timezone?: string;
  },
): Promise<EmailWorkspaceRow> {
  const res = await fetch(`${API_BASE}/api/v1/email/workspaces`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<EmailWorkspaceRow & { error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Create workspace failed', res.status);
  return out;
}

export async function patchEmailWorkspace(
  token: string,
  workspaceId: string,
  patch: Record<string, unknown>,
): Promise<EmailWorkspaceRow> {
  const res = await fetch(`${API_BASE}/api/v1/email/workspaces/${workspaceId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  const out = await parseJson<EmailWorkspaceRow & { error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Update workspace failed', res.status);
  return out;
}

export async function fetchEmailContacts(
  token: string,
  params?: { client_id?: string; q?: string; limit?: number; offset?: number },
): Promise<EmailPaged<EmailContactRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.q) qs.set('q', params.q);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/contacts${suffix}`);
}

export async function importEmailContacts(
  token: string,
  body: {
    client_id: string;
    rows: Array<{ email: string; first_name?: string; last_name?: string; lifecycle_stage?: string }>;
  },
): Promise<{ ok: boolean; created: number; updated: number; skipped: number; errors: string[] }> {
  const res = await fetch(`${API_BASE}/api/v1/email/contacts/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok: boolean; created: number; updated: number; skipped: number; errors: string[]; error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Import failed', res.status);
  return out;
}

export async function fetchEmailConsent(
  token: string,
  params?: { client_id?: string; contact_id?: string; topic?: string; limit?: number; offset?: number },
): Promise<EmailPaged<EmailConsentRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.contact_id) qs.set('contact_id', params.contact_id);
  if (params?.topic) qs.set('topic', params.topic);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/consent${suffix}`);
}

export async function recordEmailConsent(
  token: string,
  body: {
    client_id: string;
    contact_id?: string;
    email?: string;
    topic?: string;
    status: string;
    source?: string;
    consent_version?: string;
  },
): Promise<{ ok: boolean; consent_id: string; contact_id: string; preference_token?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/email/consent`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok: boolean; consent_id: string; contact_id: string; preference_token?: string; error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Record consent failed', res.status);
  return out;
}

export async function fetchEmailSuppression(
  token: string,
  params?: { client_id?: string; q?: string; limit?: number; offset?: number },
): Promise<EmailPaged<EmailSuppressionRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.q) qs.set('q', params.q);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/suppression${suffix}`);
}

export async function addEmailSuppression(
  token: string,
  body: { client_id?: string; email: string; reason: string; scope?: string },
): Promise<{ ok: boolean; id: string }> {
  const res = await fetch(`${API_BASE}/api/v1/email/suppression`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok: boolean; id: string; error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Add suppression failed', res.status);
  return out;
}

export async function fetchPublicEmailPreferences(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/email/public/preferences/${encodeURIComponent(token)}`);
  return parseJson<{
    ok: boolean;
    client_name: string;
    email: string;
    topics: Array<{ topic: string; status: string }>;
    token_purpose: string;
    error?: string;
  }>(res);
}

export async function updatePublicEmailPreferences(
  token: string,
  body: { marketing?: boolean; topics?: Array<{ topic: string; opted_in: boolean }> },
) {
  const res = await fetch(`${API_BASE}/api/v1/email/public/preferences/${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return parseJson<{ ok: boolean; error?: string }>(res);
}

export async function publicEmailUnsubscribe(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/email/public/unsubscribe/${encodeURIComponent(token)}`, {
    method: 'POST',
  });
  return parseJson<{ ok: boolean; email: string; error?: string }>(res);
}

export async function publicEmailConfirm(token: string) {
  const res = await fetch(`${API_BASE}/api/v1/email/public/confirm/${encodeURIComponent(token)}`, {
    method: 'POST',
  });
  return parseJson<{ ok: boolean; email: string; error?: string }>(res);
}

export interface EmailSegmentRow {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  segment_type: string;
  definition_json?: Record<string, unknown>;
  member_count: number;
  last_computed_at: string | null;
  status: string;
}

export interface EmailSegmentComputeResult {
  ok: boolean;
  segment_id: string;
  member_count: number;
  excluded_suppression: number;
  excluded_consent: number;
}

export interface EmailTemplateRow {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  subject_template: string;
  html_body: string;
  text_body: string | null;
  version: number;
  status: string;
}

export interface EmailCampaignRow {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  segment_id: string | null;
  segment_name: string | null;
  template_id: string;
  template_name: string;
  status: string;
  scheduled_at: string | null;
  audience_count: number | null;
}

export interface EmailPreflightCheck {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

async function emailPost<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const out = await parseJson<T & { error?: string }>(res);
  if (!res.ok) throw new ApiError((out as { error?: string }).error ?? 'Request failed', res.status);
  return out;
}

async function emailPatch<T>(token: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const out = await parseJson<T & { error?: string }>(res);
  if (!res.ok) throw new ApiError((out as { error?: string }).error ?? 'Request failed', res.status);
  return out;
}

export async function fetchEmailSegments(
  token: string,
  params?: { client_id?: string; limit?: number },
): Promise<EmailPaged<EmailSegmentRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/segments${suffix}`);
}

export async function createEmailSegment(
  token: string,
  body: { client_id: string; name: string; segment_type?: string; definition_json?: Record<string, unknown> },
): Promise<EmailSegmentRow> {
  return emailPost(token, '/api/v1/email/segments', body);
}

export async function fetchEmailSegment(token: string, segmentId: string): Promise<EmailSegmentRow> {
  return agencyFetch(token, `/api/v1/email/segments/${segmentId}`);
}

export async function patchEmailSegment(
  token: string,
  segmentId: string,
  body: { name?: string; segment_type?: string; definition_json?: Record<string, unknown> },
): Promise<EmailSegmentRow> {
  const res = await fetch(`${API_BASE}/api/v1/email/segments/${encodeURIComponent(segmentId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<EmailSegmentRow & { error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Update segment failed', res.status);
  return out;
}

export async function computeEmailSegment(
  token: string,
  segmentId: string,
): Promise<EmailSegmentComputeResult> {
  return emailPost(token, `/api/v1/email/segments/${segmentId}/compute`, {});
}

export async function fetchEmailTemplates(
  token: string,
  params?: { client_id?: string; limit?: number },
): Promise<EmailPaged<EmailTemplateRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/templates${suffix}`);
}

export async function createEmailTemplate(
  token: string,
  body: { client_id: string; name: string; subject_template: string; html_body: string; text_body?: string },
): Promise<EmailTemplateRow> {
  return emailPost(token, '/api/v1/email/templates', body);
}

export async function fetchEmailTemplate(token: string, id: string): Promise<EmailTemplateRow> {
  return agencyFetch(token, `/api/v1/email/templates/${id}`);
}

export async function patchEmailTemplate(
  token: string,
  id: string,
  patch: Partial<{ name: string; subject_template: string; html_body: string; text_body: string }>,
): Promise<EmailTemplateRow> {
  const res = await fetch(`${API_BASE}/api/v1/email/templates/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const out = await parseJson<EmailTemplateRow & { error?: string }>(res);
  if (!res.ok) throw new ApiError(out.error ?? 'Update template failed', res.status);
  return out;
}

export async function preflightEmailTemplate(
  token: string,
  id: string,
): Promise<{ ok: boolean; passed: boolean; checks: EmailPreflightCheck[] }> {
  return emailPost(token, `/api/v1/email/templates/${id}/preflight`, {});
}

export async function fetchEmailCampaigns(
  token: string,
  params?: { client_id?: string; status?: string; limit?: number },
): Promise<EmailPaged<EmailCampaignRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/campaigns${suffix}`);
}

export async function createEmailCampaign(
  token: string,
  body: { client_id: string; name: string; template_id: string; segment_id?: string },
): Promise<EmailCampaignRow> {
  return emailPost(token, '/api/v1/email/campaigns', body);
}

export async function fetchEmailCampaign(token: string, id: string): Promise<EmailCampaignRow> {
  return agencyFetch(token, `/api/v1/email/campaigns/${id}`);
}

export async function preflightEmailCampaign(
  token: string,
  id: string,
): Promise<{ ok: boolean; passed: boolean; checks: EmailPreflightCheck[] }> {
  return emailPost(token, `/api/v1/email/campaigns/${id}/preflight`, {});
}

export async function submitEmailCampaign(token: string, id: string): Promise<EmailCampaignRow> {
  return emailPost(token, `/api/v1/email/campaigns/${id}/submit`, {});
}

export async function approveEmailCampaign(
  token: string,
  id: string,
  body?: { scheduled_at?: string; note?: string },
): Promise<EmailCampaignRow & { prepare_job_id?: string | null }> {
  return emailPost(token, `/api/v1/email/campaigns/${id}/approve`, body ?? {});
}

export async function scheduleEmailCampaign(
  token: string,
  id: string,
  scheduledAt: string,
): Promise<EmailCampaignRow> {
  return emailPost(token, `/api/v1/email/campaigns/${id}/schedule`, { scheduled_at: scheduledAt });
}

export interface EmailJourneyRow {
  id: string;
  client_id: string;
  client_name: string;
  name: string;
  trigger_type: string;
  graph_json: Record<string, unknown>;
  entry_segment_id: string | null;
  entry_segment_name: string | null;
  status: string;
  enrolled_count: number;
  steps?: Array<{
    id: string;
    step_key: string;
    step_type: string;
    config_json: Record<string, unknown>;
    sort_order: number;
  }>;
}

export interface EmailDeliverabilityDomainRow {
  id: string;
  client_id: string;
  client_name: string;
  domain: string;
  spf_status: string;
  dkim_status: string;
  dmarc_status: string;
  last_checked_at: string | null;
  warm_up_stage: number;
  status: string;
}

export interface EmailReportsSummary {
  ok: boolean;
  days: number;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
  open_rate_pct: number;
  click_rate_pct: number;
  revenue_attrib: number;
}

export interface EmailDeliverabilityReport {
  ok: boolean;
  days: number;
  domains: EmailDeliverabilityDomainRow[];
  bounce_rate_pct: number;
  complaint_rate_pct: number;
  paused_domains: number;
}

export interface EmailEngagementPoint {
  date: string;
  opens: number;
  clicks: number;
}

export async function fetchEmailJourneys(
  token: string,
  params?: { client_id?: string; status?: string; limit?: number },
): Promise<EmailPaged<EmailJourneyRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/journeys${suffix}`);
}

export async function createEmailJourney(
  token: string,
  body: {
    client_id: string;
    name: string;
    entry_segment_id?: string;
    trigger_type?: string;
  },
): Promise<EmailJourneyRow> {
  return emailPost(token, '/api/v1/email/journeys', body);
}

export async function fetchEmailJourney(token: string, id: string): Promise<EmailJourneyRow> {
  return agencyFetch(token, `/api/v1/email/journeys/${id}`);
}

export async function activateEmailJourney(token: string, id: string): Promise<EmailJourneyRow> {
  return emailPost(token, `/api/v1/email/journeys/${id}/activate`, {});
}

export async function patchEmailJourney(
  token: string,
  id: string,
  body: { name?: string; graph_json?: Record<string, unknown>; entry_segment_id?: string | null; status?: string },
): Promise<EmailJourneyRow> {
  return emailPatch(token, `/api/v1/email/journeys/${id}`, body);
}

export interface EmailExperimentVariantRow {
  id: string;
  experiment_id: string;
  variant_key: string;
  label: string;
  config_json: Record<string, unknown>;
  split_pct: number;
  created_at: string;
}

export interface EmailExperimentRow {
  id: string;
  client_id: string;
  client_name: string;
  campaign_id: string | null;
  campaign_name: string | null;
  name: string;
  experiment_type: string;
  hypothesis: string | null;
  status: string;
  winner_variant_key: string | null;
  config_json: Record<string, unknown>;
  started_at: string | null;
  ended_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  variants?: EmailExperimentVariantRow[];
}

export async function fetchCampaignExperiment(
  token: string,
  campaignId: string,
): Promise<EmailExperimentRow | null> {
  return agencyFetch(token, `/api/v1/email/campaigns/${campaignId}/experiment`);
}

export async function createEmailExperiment(
  token: string,
  body: {
    client_id: string;
    campaign_id: string;
    name: string;
    hypothesis?: string;
    variants: Array<{ variant_key: string; label: string; subject?: string; split_pct?: number }>;
  },
): Promise<EmailExperimentRow> {
  return emailPost(token, '/api/v1/email/experiments', body);
}

export async function startEmailExperiment(token: string, id: string): Promise<EmailExperimentRow> {
  return emailPost(token, `/api/v1/email/experiments/${id}/start`, {});
}

export async function rollupEmailExperiment(
  token: string,
  id: string,
): Promise<{ ok: boolean; experiment_id: string; job_id?: string | null }> {
  return emailPost(token, `/api/v1/email/experiments/${id}/rollup`, {});
}

export async function declareEmailExperimentWinner(
  token: string,
  id: string,
  variantKey: string,
  rationale?: string,
): Promise<EmailExperimentRow> {
  return emailPost(token, `/api/v1/email/experiments/${id}/declare-winner`, {
    variant_key: variantKey,
    rationale,
  });
}

export async function fetchEmailDeliverabilityDomains(
  token: string,
  params?: { client_id?: string; limit?: number },
): Promise<EmailPaged<EmailDeliverabilityDomainRow>> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/deliverability/domains${suffix}`);
}

export async function registerEmailDomain(
  token: string,
  body: { client_id: string; domain: string },
): Promise<EmailDeliverabilityDomainRow> {
  return emailPost(token, '/api/v1/email/deliverability/domains', body);
}

export async function verifyEmailDomain(token: string, id: string): Promise<EmailDeliverabilityDomainRow> {
  return emailPost(token, `/api/v1/email/deliverability/domains/${id}/verify`, {});
}

export async function pauseEmailDomain(token: string, id: string): Promise<EmailDeliverabilityDomainRow> {
  return emailPost(token, `/api/v1/email/deliverability/domains/${id}/pause`, {});
}

export async function fetchEmailReportsSummary(
  token: string,
  params?: { client_id?: string; days?: number },
): Promise<EmailReportsSummary> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.days != null) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/reports/summary${suffix}`);
}

export async function fetchEmailDeliverabilityReport(
  token: string,
  params?: { client_id?: string; days?: number },
): Promise<EmailDeliverabilityReport> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.days != null) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/reports/deliverability${suffix}`);
}

export async function fetchEmailEngagementSeries(
  token: string,
  params?: { client_id?: string; days?: number },
): Promise<{ ok: boolean; points: EmailEngagementPoint[] }> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.days != null) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return agencyFetch(token, `/api/v1/email/reports/engagement${suffix}`);
}

export interface EmailReportScheduleRow {
  id: string;
  client_id: string;
  client_name: string;
  report_type: string;
  cadence: string;
  day_of_week: number;
  day_of_month: number;
  recipient_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  active: boolean;
  next_run_at: string | null;
  last_sent_at: string | null;
}

export async function exportEmailClickhouse(
  token: string,
  params?: { fact_date?: string; client_id?: string },
): Promise<{ ok: boolean; job_id: string | null; mode: string }> {
  const qs = new URLSearchParams();
  if (params?.fact_date) qs.set('fact_date', params.fact_date);
  if (params?.client_id) qs.set('client_id', params.client_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return emailPost(token, `/api/v1/email/reports/export-clickhouse${suffix}`, {});
}

export async function fetchEmailReportSchedules(
  token: string,
  clientId: string,
): Promise<{ ok: boolean; items: EmailReportScheduleRow[]; total: number }> {
  const qs = new URLSearchParams({ client_id: clientId });
  return agencyFetch(token, `/api/v1/email/reports/schedules?${qs.toString()}`);
}

export async function createEmailReportSchedule(
  token: string,
  body: {
    client_id: string;
    report_type?: string;
    cadence?: string;
    day_of_week?: number;
    recipient_emails?: string[];
  },
): Promise<EmailReportScheduleRow> {
  return emailPost(token, '/api/v1/email/reports/schedules', body);
}

export async function runEmailReportSchedule(
  token: string,
  scheduleId: string,
): Promise<{ ok: boolean; job_id: string | null }> {
  return emailPost(token, `/api/v1/email/reports/schedules/${scheduleId}/run`, {});
}

export interface ChannelReportScheduleRow {
  id: string;
  client_id: string;
  client_name: string;
  report_scope: 'clients' | 'campaigns';
  export_format: 'csv' | 'pdf';
  window_days: number;
  cadence: string;
  day_of_week: number;
  day_of_month: number;
  recipient_emails: string[];
  cc_emails: string[];
  bcc_emails: string[];
  portal_link_enabled: boolean;
  active: boolean;
  next_run_at: string | null;
  last_sent_at: string | null;
}

function channelReportBase(channel: 'meta' | 'zalo'): string {
  return channel === 'meta' ? '/api/v1/facebook-ads/reports/schedules' : '/api/v1/zalo-ads/reports/schedules';
}

export async function fetchChannelReportSchedules(
  token: string,
  channel: 'meta' | 'zalo',
  clientId: string,
): Promise<{ ok: boolean; items: ChannelReportScheduleRow[]; total: number; table_ready?: boolean }> {
  const qs = new URLSearchParams({ client_id: clientId });
  return agencyFetch(token, `${channelReportBase(channel)}?${qs.toString()}`);
}

export async function createChannelReportSchedule(
  token: string,
  channel: 'meta' | 'zalo',
  body: {
    client_id: string;
    report_scope?: 'clients' | 'campaigns';
    export_format?: 'csv' | 'pdf';
    window_days?: number;
    cadence?: string;
    day_of_week?: number;
    recipient_emails?: string[];
    portal_link_enabled?: boolean;
  },
): Promise<ChannelReportScheduleRow> {
  return agencyMutate(token, channelReportBase(channel), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function runChannelReportSchedule(
  token: string,
  channel: 'meta' | 'zalo',
  scheduleId: string,
): Promise<{ ok: boolean; job_id: string | null }> {
  return agencyMutate(token, `${channelReportBase(channel)}/${scheduleId}/run`, {
    method: 'POST',
    body: '{}',
  });
}

export async function deleteChannelReportSchedule(
  token: string,
  channel: 'meta' | 'zalo',
  scheduleId: string,
): Promise<{ ok: boolean }> {
  return agencyMutate(token, `${channelReportBase(channel)}/${scheduleId}/delete`, {
    method: 'POST',
    body: '{}',
  });
}

export type CrmCustomFieldEntityType = 'lead' | 'customer' | 'case';
export type CrmCustomFieldType = 'text' | 'number' | 'select' | 'date' | 'boolean';

export interface CrmCustomFieldDef {
  id: number;
  entity_type: CrmCustomFieldEntityType;
  field_key: string;
  label: string;
  field_type: CrmCustomFieldType;
  options: string[];
  required: boolean;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CrmPipelineStageDef {
  id: number;
  pipeline_key: string;
  stage_key: string;
  label: string;
  sort_order: number;
  sla_hours: number;
  owner_role: string;
  is_terminal: boolean;
  active: boolean;
  updated_at: string;
}

export async function fetchCrmCustomFields(
  token: string,
  params?: { entity_type?: CrmCustomFieldEntityType },
): Promise<{ fields: CrmCustomFieldDef[] }> {
  const qs = params?.entity_type ? `?entity_type=${encodeURIComponent(params.entity_type)}` : '';
  return crmFetch(token, `/api/crm/config/custom-fields${qs}`);
}

export async function fetchCrmCustomField(token: string, id: number): Promise<CrmCustomFieldDef> {
  return crmFetch(token, `/api/crm/config/custom-fields/${id}`);
}

export async function createCrmCustomField(
  token: string,
  body: {
    entity_type: CrmCustomFieldEntityType;
    field_key: string;
    label: string;
    field_type?: CrmCustomFieldType;
    options?: string[];
    required?: boolean;
    sort_order?: number;
    active?: boolean;
  },
): Promise<CrmCustomFieldDef> {
  return crmFetch(token, '/api/crm/config/custom-fields', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateCrmCustomField(
  token: string,
  id: number,
  body: Partial<{
    label: string;
    field_type: CrmCustomFieldType;
    options: string[];
    required: boolean;
    sort_order: number;
    active: boolean;
  }>,
): Promise<CrmCustomFieldDef> {
  return crmFetch(token, `/api/crm/config/custom-fields/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteCrmCustomField(
  token: string,
  id: number,
): Promise<{ ok: true; id: number }> {
  return crmFetch(token, `/api/crm/config/custom-fields/${id}`, { method: 'DELETE' });
}

export async function fetchCrmSalesPipelineStages(
  token: string,
  params?: { include_inactive?: boolean },
): Promise<{ pipeline_key: string; stages: CrmPipelineStageDef[] }> {
  const qs = params?.include_inactive ? '?include_inactive=1' : '';
  return crmFetch(token, `/api/crm/config/pipeline/sales/stages${qs}`);
}

export async function createCrmPipelineStage(
  token: string,
  body: {
    stage_key?: string;
    label: string;
    sort_order?: number;
    sla_hours?: number;
    owner_role?: string;
    is_terminal?: boolean;
    active?: boolean;
  },
): Promise<CrmPipelineStageDef> {
  return crmFetch(token, '/api/crm/config/pipeline/sales/stages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchCrmPipelineStage(
  token: string,
  stageKey: string,
  body: Partial<{
    label: string;
    sort_order: number;
    sla_hours: number;
    owner_role: string;
    is_terminal: boolean;
    active: boolean;
  }>,
): Promise<CrmPipelineStageDef> {
  return crmFetch(token, `/api/crm/config/pipeline/sales/stages/${encodeURIComponent(stageKey)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteCrmPipelineStage(
  token: string,
  stageKey: string,
): Promise<{ ok: true; stage_key: string }> {
  return crmFetch(token, `/api/crm/config/pipeline/sales/stages/${encodeURIComponent(stageKey)}`, {
    method: 'DELETE',
  });
}

export async function saveCrmSalesPipelineStages(
  token: string,
  stages: Array<{
    stage_key: string;
    label: string;
    sort_order?: number;
    sla_hours?: number;
    owner_role?: string;
    is_terminal?: boolean;
    active?: boolean;
  }>,
): Promise<{ pipeline_key: string; stages: CrmPipelineStageDef[] }> {
  return crmFetch(token, '/api/crm/config/pipeline/sales/stages', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stages }),
  });
}

export type CrmLeadLookupKind = 'source' | 'channel';

export interface CrmLeadLookupOption {
  id: number;
  kind: CrmLeadLookupKind;
  option_key: string;
  label: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchLeadLookupOptions(
  token: string,
  kind?: CrmLeadLookupKind,
): Promise<{ options: CrmLeadLookupOption[] }> {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return crmFetch(token, `/api/v1/leads/lookup-options${qs}`);
}

export async function fetchCrmLeadLookups(
  token: string,
  params?: { kind?: CrmLeadLookupKind; active_only?: boolean },
): Promise<{ options: CrmLeadLookupOption[] }> {
  const qs = new URLSearchParams();
  if (params?.kind) qs.set('kind', params.kind);
  if (params?.active_only) qs.set('active_only', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/config/lead-lookups${suffix}`);
}

export async function createCrmLeadLookup(
  token: string,
  body: {
    kind: CrmLeadLookupKind;
    option_key?: string;
    label: string;
    sort_order?: number;
    active?: boolean;
  },
): Promise<CrmLeadLookupOption> {
  return crmFetch(token, '/api/crm/config/lead-lookups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateCrmLeadLookup(
  token: string,
  id: number,
  body: Partial<{ label: string; sort_order: number; active: boolean }>,
): Promise<CrmLeadLookupOption> {
  return crmFetch(token, `/api/crm/config/lead-lookups/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteCrmLeadLookup(
  token: string,
  id: number,
): Promise<{ ok: true; id: number }> {
  return crmFetch(token, `/api/crm/config/lead-lookups/${id}`, { method: 'DELETE' });
}

export interface CrmTicketRow {
  id: number;
  customer_id: number;
  customer_name: string;
  agency_client_id?: string | null;
  ticket_type: string;
  ticket_type_label: string;
  status: string;
  status_label: string;
  priority: string;
  priority_label: string;
  channel: string;
  channel_label: string;
  title: string;
  description: string;
  resolution: string;
  assigned_staff_id: number | null;
  assigned_staff_name: string;
  sentiment_label?: string | null;
  sentiment_score?: number | null;
  sentiment_confidence?: number | null;
  sentiment_scored_at?: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string;
}

export interface CrmTicketMessageRow {
  id: number;
  ticket_id: number;
  author_staff_id: number | null;
  author_staff_name: string;
  body: string;
  is_internal: boolean;
  created_at: string;
}

export async function fetchCrmTickets(
  token: string,
  params?: {
    q?: string;
    status?: string;
    priority?: string;
    sentiment?: string;
    customer_id?: number;
    assigned_staff_id?: number;
    limit?: number;
    offset?: number;
  },
): Promise<{ tickets: CrmTicketRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.status) qs.set('status', params.status);
  if (params?.priority) qs.set('priority', params.priority);
  if (params?.sentiment) qs.set('sentiment', params.sentiment);
  if (params?.customer_id) qs.set('customer_id', String(params.customer_id));
  if (params?.assigned_staff_id) qs.set('assigned_staff_id', String(params.assigned_staff_id));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/crm/tickets${suffix}`);
}

export async function createCrmTicket(
  token: string,
  body: {
    customer_id: number;
    ticket_type?: string;
    priority?: string;
    channel?: string;
    title: string;
    description?: string;
    assigned_staff_id?: number | null;
  },
): Promise<CrmTicketRow> {
  return crmFetch(token, '/api/crm/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchCrmTicket(
  token: string,
  id: number,
  body: Partial<{
    ticket_type: string;
    priority: string;
    status: string;
    channel: string;
    title: string;
    description: string;
    resolution: string;
    assigned_staff_id: number | null;
  }>,
): Promise<CrmTicketRow> {
  return crmFetch(token, `/api/crm/tickets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchCrmTicket(token: string, id: number): Promise<CrmTicketRow> {
  return crmFetch(token, `/api/crm/tickets/${id}`);
}

export async function fetchCrmTicketMessages(
  token: string,
  id: number,
): Promise<{ messages: CrmTicketMessageRow[] }> {
  return crmFetch(token, `/api/crm/tickets/${id}/messages`);
}

export async function addCrmTicketMessage(
  token: string,
  id: number,
  body: { body: string; is_internal?: boolean; author_staff_id?: number | null },
): Promise<CrmTicketMessageRow> {
  return crmFetch(token, `/api/crm/tickets/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export interface StaffPermissionPositionSummary {
  id: number;
  code: string;
  name: string;
  active: boolean;
  grants_customized: boolean;
}

export interface StaffPermissionMatrixRow {
  section_id: string;
  section_label: string;
  group: string;
  page: string;
  description: string;
  row_kind: 'section' | 'ui_button';
  parent_section?: string;
  requires_action?: string;
  actions: string[];
  allowed: string[];
}

export interface StaffPermissionPositionDetail extends StaffPermissionPositionSummary {
  grants: Record<string, string[]>;
  matrix: StaffPermissionMatrixRow[];
}

export interface StaffPermissionAuditRow {
  id: number;
  actor_email: string;
  position_id: number;
  position_code: string;
  diff_json: Record<string, unknown>;
  created_at: string;
}

export async function fetchStaffPermissionsCatalog(token: string) {
  return crmFetch(token, '/api/v1/staff/permissions/catalog');
}

export async function fetchStaffPermissionPositions(token: string): Promise<StaffPermissionPositionSummary[]> {
  return crmFetch(token, '/api/v1/staff/permissions/positions');
}

export async function fetchStaffPermissionPosition(
  token: string,
  positionId: number,
): Promise<StaffPermissionPositionDetail> {
  return crmFetch(token, `/api/v1/staff/permissions/positions/${positionId}`);
}

export async function patchStaffPermissionPosition(
  token: string,
  positionId: number,
  body: { grants: Record<string, string[]> },
) {
  return crmFetch(token, `/api/v1/staff/permissions/positions/${positionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchStaffPermissionAudit(
  token: string,
  params?: { position_id?: number; limit?: number },
): Promise<StaffPermissionAuditRow[]> {
  const qs = new URLSearchParams();
  if (params?.position_id != null) qs.set('position_id', String(params.position_id));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/v1/staff/permissions/audit${suffix}`);
}

export async function exportStaffPermissionPosition(
  token: string,
  positionId: number,
): Promise<{
  format: string;
  position_id: number;
  position_code: string;
  position_name: string;
  markdown: string;
  grants: Record<string, string[]>;
  matrix: StaffPermissionMatrixRow[];
}> {
  return crmFetch(token, `/api/v1/staff/permissions/positions/${positionId}/export`);
}

export interface StaffJobFunctionSummary {
  code: string;
  label: string;
  description: string;
  department_scope: string;
  sort_order: number;
  grants_customized: boolean;
}

export interface StaffJobFunctionDetail extends StaffJobFunctionSummary {
  grants: Record<string, string[]>;
  matrix: StaffPermissionMatrixRow[];
}

export async function fetchStaffJobFunctions(token: string): Promise<StaffJobFunctionSummary[]> {
  return crmFetch(token, '/api/v1/staff/permissions/job-functions');
}

export async function fetchStaffJobFunction(
  token: string,
  code: string,
): Promise<StaffJobFunctionDetail> {
  return crmFetch(token, `/api/v1/staff/permissions/job-functions/${encodeURIComponent(code)}`);
}

export async function patchStaffJobFunction(
  token: string,
  code: string,
  body: { grants: Record<string, string[]> },
): Promise<{
  ok: boolean;
  function_code: string;
  added: number;
  removed: number;
  diff: Record<string, unknown>;
  function: StaffJobFunctionDetail;
}> {
  return crmFetch(token, `/api/v1/staff/permissions/job-functions/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function exportStaffJobFunction(
  token: string,
  code: string,
): Promise<{
  format: string;
  function_code: string;
  function_label: string;
  markdown: string;
  grants: Record<string, string[]>;
  matrix: StaffPermissionMatrixRow[];
}> {
  return crmFetch(token, `/api/v1/staff/permissions/job-functions/${encodeURIComponent(code)}/export`);
}

export interface StaffOrgUserSummary {
  id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  active?: boolean;
  crm_staff_id?: number;
  team_ids?: number[];
  team_codes?: string[];
  job_functions: string[];
  client_ids?: string[];
}

export interface CreateStaffOrgUserInput {
  email: string;
  display_name?: string;
  position_id: number;
  team_ids?: number[];
  functions?: string[];
  password?: string;
  crm_staff_id?: number;
  account_kind?: 'staff' | 'guest' | 'contractor';
  expires_at?: string | null;
  crm_staff?: {
    name?: string;
    display_name?: string;
    phone?: string;
    job_title?: string;
    internal_code?: string;
    department_id?: number | null;
  };
}

export interface PatchStaffOrgUserInput {
  display_name?: string;
  position_id?: number;
  team_ids?: number[];
  active?: boolean;
  password?: string;
  account_kind?: 'staff' | 'guest' | 'contractor';
  expires_at?: string | null;
}

export interface StaffUserEffectiveCaps {
  user_id: string;
  email: string;
  display_name: string;
  position_id: number;
  position_code?: string;
  job_functions: string[];
  permission_sets?: string[];
  caps: Array<{ section: string; action: string }>;
}

export async function fetchStaffOrgUsers(
  token: string,
  opts?: { q?: string; includeInactive?: boolean },
): Promise<StaffOrgUserSummary[]> {
  const params = new URLSearchParams();
  if (opts?.q) params.set('q', opts.q);
  if (opts?.includeInactive) params.set('include_inactive', '1');
  const qs = params.toString();
  const data = await crmFetch<{ users: StaffOrgUserSummary[] }>(
    token,
    `/api/v1/staff/org/users${qs ? `?${qs}` : ''}`,
  );
  return data.users ?? (data as unknown as StaffOrgUserSummary[]);
}

export async function fetchStaffOrgUser(token: string, userId: string): Promise<StaffOrgUserSummary> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}`);
}

export async function createStaffOrgUser(
  token: string,
  body: CreateStaffOrgUserInput,
): Promise<{ user: StaffOrgUserSummary; temp_password?: string }> {
  return crmFetch(token, '/api/v1/staff/org/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchStaffOrgUser(
  token: string,
  userId: string,
  body: PatchStaffOrgUserInput,
): Promise<StaffOrgUserSummary> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function offboardStaffOrgUser(
  token: string,
  userId: string,
  body: { reassign_to: number; deactivate?: boolean },
): Promise<{ user: StaffOrgUserSummary; leads_reassigned: number }> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}/offboard`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchStaffOrgJobFunctionCatalog(
  token: string,
): Promise<Array<{ code: string; label: string; description: string; department_scope: string }>> {
  const data = await crmFetch<{ functions: Array<{ code: string; label: string; description: string; department_scope: string }> }>(
    token,
    '/api/v1/staff/org/job-functions/catalog',
  );
  return data.functions ?? [];
}

export async function fetchStaffUserJobFunctions(
  token: string,
  userId: string,
): Promise<{ user_id: string; functions: string[]; position_code?: string; email: string; display_name: string }> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}/job-functions`);
}

export async function putStaffUserJobFunctions(
  token: string,
  userId: string,
  functions: string[],
): Promise<{ user_id: string; functions: string[] }> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}/job-functions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ functions }),
  });
}

export async function fetchStaffUserClientScope(
  token: string,
  userId: string,
): Promise<{ user_id: string; client_ids: string[] }> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}/client-scope`);
}

export async function putStaffUserClientScope(
  token: string,
  userId: string,
  clientIds: string[],
): Promise<{ user_id: string; client_ids: string[] }> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}/client-scope`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_ids: clientIds }),
  });
}

export async function importStaffUserClientScope(
  token: string,
  csv: string,
  dryRun = false,
): Promise<{
  ok: boolean;
  dry_run: boolean;
  rows: number;
  applied: number;
  preview: Array<{ email: string; client_ids: string[]; error?: string }>;
  errors: string[];
}> {
  return crmFetch(token, '/api/v1/staff/org/users/client-scope/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv, dry_run: dryRun }),
  });
}

export interface StaffFieldRegistryEntry {
  entity: string;
  field: string;
  section: string;
  action: string;
  mask_mode: string;
  mask_value?: string;
  patch_forbidden?: boolean;
  export_strip?: boolean;
}

export async function fetchStaffFieldRegistry(
  token: string,
): Promise<{ version: number; fields: StaffFieldRegistryEntry[] }> {
  return crmFetch(token, '/api/v1/staff/permissions/field-registry');
}

export async function fetchStaffUserEffectiveCaps(
  token: string,
  userId: string,
): Promise<StaffUserEffectiveCaps> {
  return crmFetch(token, `/api/v1/staff/org/users/${encodeURIComponent(userId)}/effective-caps`);
}

export interface StaffDepartmentRow {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  active: boolean;
}

export interface StaffTeamRow {
  id: number;
  code: string;
  name: string;
  department_id: number | null;
  department_code?: string;
  department_name?: string;
  active: boolean;
}

export interface StaffOrgPositionRow {
  id: number;
  code: string;
  name: string;
  parent_id: number | null;
  department_id: number | null;
  department_code?: string;
  active: boolean;
}

export async function fetchStaffOrgDepartments(token: string): Promise<StaffDepartmentRow[]> {
  const data = await crmFetch<{ departments: StaffDepartmentRow[] }>(token, '/api/v1/staff/org/departments');
  return data.departments ?? [];
}

export async function createStaffOrgDepartment(
  token: string,
  body: { code: string; name: string; parent_id?: number | null },
): Promise<StaffDepartmentRow> {
  return crmFetch(token, '/api/v1/staff/org/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchStaffOrgDepartment(
  token: string,
  id: number,
  body: Partial<{ code: string; name: string; parent_id: number | null; active: boolean }>,
): Promise<StaffDepartmentRow> {
  return crmFetch(token, `/api/v1/staff/org/departments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchStaffOrgTeams(
  token: string,
  departmentId?: number,
): Promise<StaffTeamRow[]> {
  const qs = departmentId != null ? `?department_id=${departmentId}` : '';
  const data = await crmFetch<{ teams: StaffTeamRow[] }>(token, `/api/v1/staff/org/teams${qs}`);
  return data.teams ?? [];
}

export async function createStaffOrgTeam(
  token: string,
  body: { code: string; name: string; department_id?: number | null },
): Promise<StaffTeamRow> {
  return crmFetch(token, '/api/v1/staff/org/teams', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchStaffOrgTeam(
  token: string,
  id: number,
  body: Partial<{ code: string; name: string; department_id: number | null; active: boolean }>,
): Promise<StaffTeamRow> {
  return crmFetch(token, `/api/v1/staff/org/teams/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchStaffOrgNextInternalCode(
  token: string,
): Promise<{ internal_code: string }> {
  return crmFetch(token, '/api/v1/staff/org/users/next-internal-code');
}

export async function fetchStaffOrgPositions(token: string): Promise<StaffOrgPositionRow[]> {
  const data = await crmFetch<{ positions: StaffOrgPositionRow[] }>(token, '/api/v1/staff/org/positions');
  return data.positions ?? [];
}

export async function patchStaffOrgPosition(
  token: string,
  id: number,
  body: Partial<{ name: string; parent_id: number | null; department_id: number | null; active: boolean }>,
): Promise<StaffOrgPositionRow> {
  return crmFetch(token, `/api/v1/staff/org/positions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type StaffOrgChartNode = {
  id: number;
  name: string;
  reports_to_id: number | null;
  department: string;
  job_title: string;
  position_code: string | null;
  active: boolean;
};

export async function fetchStaffOrgChart(
  token: string,
  opts?: { includeInactive?: boolean },
): Promise<StaffOrgChartNode[]> {
  const qs = opts?.includeInactive ? '?include_inactive=1' : '';
  const data = await crmFetch<{ nodes: StaffOrgChartNode[] }>(token, `/api/v1/staff/org/chart${qs}`);
  return data.nodes ?? [];
}

export interface StaffPermissionSetSummary {
  id: number;
  code: string;
  name: string;
  active: boolean;
  grant_count: number;
}

export interface StaffPermissionSetDetail {
  id: number;
  code: string;
  name: string;
  active: boolean;
  grants: Array<{ section_id: string; action: string }>;
  matrix: StaffPermissionMatrixRow[];
}

export async function fetchStaffPermissionSets(token: string): Promise<StaffPermissionSetSummary[]> {
  const data = await crmFetch<{ sets: StaffPermissionSetSummary[] }>(token, '/api/v1/staff/permission-sets');
  return data.sets ?? [];
}

export async function fetchStaffPermissionSet(token: string, code: string): Promise<StaffPermissionSetDetail> {
  return crmFetch(token, `/api/v1/staff/permission-sets/${encodeURIComponent(code)}`);
}

export async function createStaffPermissionSet(
  token: string,
  body: { code: string; name: string },
): Promise<StaffPermissionSetDetail> {
  return crmFetch(token, '/api/v1/staff/permission-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchStaffPermissionSet(
  token: string,
  code: string,
  body: { name?: string; active?: boolean },
): Promise<StaffPermissionSetDetail> {
  return crmFetch(token, `/api/v1/staff/permission-sets/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function putStaffPermissionSetGrants(
  token: string,
  code: string,
  grants: Array<{ section_id: string; action: string }>,
): Promise<StaffPermissionSetDetail> {
  return crmFetch(token, `/api/v1/staff/permission-sets/${encodeURIComponent(code)}/grants`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grants }),
  });
}

export async function fetchStaffUserPermissionSets(
  token: string,
  userId: string,
): Promise<{ user_id: string; set_codes: string[] }> {
  return crmFetch(token, `/api/v1/staff/permission-sets/users/${encodeURIComponent(userId)}`);
}

export async function putStaffUserPermissionSets(
  token: string,
  userId: string,
  setCodes: string[],
): Promise<{ user_id: string; set_codes: string[] }> {
  return crmFetch(token, `/api/v1/staff/permission-sets/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ set_codes: setCodes }),
  });
}

export type StaffPermissionSimulateBody = {
  position_id: number;
  job_functions?: string[];
  set_codes?: string[];
  compare_user_id?: string;
};

export type StaffPermissionSimulateMenuItem = {
  href: string;
  label: string;
  section: string;
  visible: boolean;
};

export type StaffPermissionSimulateResponse = {
  caps: string[];
  menu: StaffPermissionSimulateMenuItem[];
  diff: { added: string[]; removed: string[] };
};

export async function simulateStaffPermissions(
  token: string,
  body: StaffPermissionSimulateBody,
): Promise<StaffPermissionSimulateResponse> {
  return crmFetch(token, '/api/v1/staff/permissions/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function downloadStaffAccessReviewZip(token: string, quarter?: string): Promise<void> {
  const qs = quarter?.trim() ? `?quarter=${encodeURIComponent(quarter.trim())}` : '';
  await downloadBinary(token, `/api/v1/staff/permissions/access-review.zip${qs}`, 'access-review.zip');
}

export type BreakGlassCap = { section: string; action: string };

export type BreakGlassGrant = {
  id: string;
  user_id: string;
  user_email?: string;
  caps: BreakGlassCap[];
  reason: string;
  status: string;
  requested_at: string;
  expires_at?: string | null;
};

export async function requestBreakGlass(
  token: string,
  body: { reason: string; caps_requested: BreakGlassCap[] },
): Promise<BreakGlassGrant> {
  return crmFetch(token, '/api/v1/staff/break-glass/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchActiveBreakGlassGrants(token: string): Promise<{ grants: BreakGlassGrant[] }> {
  return crmFetch(token, '/api/v1/staff/break-glass/active');
}

export async function approveBreakGlassGrant(
  token: string,
  id: string,
  body: { approve?: boolean; reject_reason?: string },
): Promise<BreakGlassGrant> {
  return crmFetch(token, `/api/v1/staff/break-glass/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type AdminAuditEventCategory =
  | 'permission_matrix'
  | 'permission_function'
  | 'org_user'
  | 'org_structure'
  | 'rbac_event'
  | 'pii_access'
  | 'config_snapshot';

export type AdminAuditSeverity = 'info' | 'warning' | 'critical';

export type AdminAuditEvent = {
  id: string;
  source: string;
  category: AdminAuditEventCategory;
  severity: AdminAuditSeverity;
  actor_email: string;
  subject_label?: string;
  subject_id?: string;
  action: string;
  summary: string;
  diff_json: Record<string, unknown>;
  created_at: string;
};

export type AdminAuditListResponse = {
  events: AdminAuditEvent[];
  next_cursor: string | null;
  has_more: boolean;
};

export async function fetchAdminAuditEvents(
  token: string,
  params?: {
    from?: string;
    to?: string;
    actor?: string;
    subject?: string;
    category?: string;
    severity?: string;
    q?: string;
    cursor?: string;
    limit?: number;
  },
): Promise<AdminAuditListResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.actor) qs.set('actor', params.actor);
  if (params?.subject) qs.set('subject', params.subject);
  if (params?.category) qs.set('category', params.category);
  if (params?.severity) qs.set('severity', params.severity);
  if (params?.q) qs.set('q', params.q);
  if (params?.cursor) qs.set('cursor', params.cursor);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/v1/admin/audit${suffix}`);
}

export async function fetchAdminAuditEvent(token: string, eventId: string): Promise<AdminAuditEvent> {
  return crmFetch(token, `/api/v1/admin/audit/events/${encodeURIComponent(eventId)}`);
}

export async function requestAdminAuditExport(
  token: string,
  body: {
    format: 'csv' | 'json';
    from?: string;
    to?: string;
    actor?: string;
    subject?: string;
    category?: string;
    severity?: string;
    q?: string;
  },
): Promise<{ job_id: string; status: string; format: string; created_at: string }> {
  return crmFetch(token, '/api/v1/admin/audit/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function signAdminConfigSnapshot(
  token: string,
  body: {
    snapshot_type: 'permission_matrix' | 'org_chart';
    entity_key: string;
    note?: string;
    payload?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; snapshot_id: number }> {
  return crmFetch(token, '/api/v1/admin/audit/snapshots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function pollAdminAuditExportJob(
  token: string,
  jobId: string,
): Promise<{ job_id: string; status: string; row_count?: number; error_message?: string }> {
  return crmFetch(token, `/api/v1/admin/audit/export/${encodeURIComponent(jobId)}`);
}

export async function downloadAdminAuditExport(token: string, jobId: string, format: 'csv' | 'json') {
  await downloadBinary(
    token,
    `/api/v1/admin/audit/export/${encodeURIComponent(jobId)}`,
    `admin-audit.${format}`,
  );
}

// --- Admin Governance R4 ---

export type AccessReviewCampaignStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type AccessReviewCampaign = {
  id: string;
  title: string;
  quarter: string;
  status: AccessReviewCampaignStatus;
  scope_type: string;
  scope_ref: string | null;
  due_at: string;
  owner_email: string;
  launched_at: string | null;
  closed_at: string | null;
  item_counts: { pending: number; certified: number; revoke: number; total: number };
  created_at: string;
};

export type AccessReviewItem = {
  id: string;
  campaign_id: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  position_code: string | null;
  decision: string;
  certifier_email: string | null;
  certifier_note: string | null;
  decided_at: string | null;
  days_until_due?: number | null;
  risk_flags?: string[];
  snapshot_json?: Record<string, unknown>;
};

export type StaleAccountRow = {
  user_id: string;
  email: string;
  display_name: string;
  active: boolean;
  account_kind: string;
  last_login_at: string | null;
  days_since_login: number | null;
  position_code: string | null;
  risk: string;
  admin_cap_count: number;
};

export type AdminIntegrationRow = {
  id: string;
  kind: string;
  name: string;
  status: string;
  detail: string;
  redirect_href?: string;
};

export async function fetchAccessReviewCampaigns(
  token: string,
  status?: AccessReviewCampaignStatus,
): Promise<{ campaigns: AccessReviewCampaign[] }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return crmFetch(token, `/api/v1/admin/governance/access-reviews/campaigns${qs}`);
}

export async function createAccessReviewCampaign(
  token: string,
  body: {
    title: string;
    quarter?: string;
    scope_type?: string;
    scope_ref?: string | null;
    due_at?: string;
  },
): Promise<AccessReviewCampaign> {
  return crmFetch(token, '/api/v1/admin/governance/access-reviews/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchAccessReviewCampaign(token: string, id: string): Promise<AccessReviewCampaign> {
  return crmFetch(token, `/api/v1/admin/governance/access-reviews/campaigns/${encodeURIComponent(id)}`);
}

export async function launchAccessReviewCampaign(
  token: string,
  id: string,
): Promise<{ ok: boolean; launched: number; campaign: AccessReviewCampaign }> {
  return crmFetch(token, `/api/v1/admin/governance/access-reviews/campaigns/${encodeURIComponent(id)}/launch`, {
    method: 'POST',
  });
}

export async function closeAccessReviewCampaign(
  token: string,
  id: string,
  force?: boolean,
): Promise<{ ok: boolean; applied_revokes: number; campaign: AccessReviewCampaign }> {
  const qs = force ? '?force=1' : '';
  return crmFetch(token, `/api/v1/admin/governance/access-reviews/campaigns/${encodeURIComponent(id)}/close${qs}`, {
    method: 'POST',
  });
}

export async function fetchAccessReviewItems(
  token: string,
  campaignId: string,
  decision?: string,
): Promise<{ items: AccessReviewItem[]; campaign_id: string }> {
  const qs = decision ? `?decision=${encodeURIComponent(decision)}` : '';
  return crmFetch(
    token,
    `/api/v1/admin/governance/access-reviews/campaigns/${encodeURIComponent(campaignId)}/items${qs}`,
  );
}

export async function fetchAccessReviewInbox(
  token: string,
  campaignId?: string,
): Promise<{ items: AccessReviewItem[]; count: number }> {
  const qs = campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : '';
  return crmFetch(token, `/api/v1/admin/governance/access-reviews/inbox${qs}`);
}

export async function patchAccessReviewItem(
  token: string,
  itemId: string,
  body: { decision: string; note?: string },
): Promise<AccessReviewItem> {
  return crmFetch(token, `/api/v1/admin/governance/access-reviews/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchStaleAccounts(
  token: string,
  params?: { inactive_days?: number; admin_only?: boolean },
): Promise<{ accounts: StaleAccountRow[]; threshold_days: number }> {
  const qs = new URLSearchParams();
  if (params?.inactive_days != null) qs.set('inactive_days', String(params.inactive_days));
  if (params?.admin_only) qs.set('admin_only', '1');
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return crmFetch(token, `/api/v1/admin/governance/stale-accounts${suffix}`);
}

export async function fetchAdminIntegrations(
  token: string,
): Promise<{ integrations: AdminIntegrationRow[]; summary: Record<string, number> }> {
  return crmFetch(token, '/api/v1/admin/integrations');
}

export async function fetchAdminIntegrationsHealth(
  token: string,
): Promise<{ ok: boolean; summary: Record<string, number>; expiring_count: number; critical_count: number }> {
  return crmFetch(token, '/api/v1/admin/integrations/health');
}

// --- Admin Control Plane R5 (Policy Intelligence) ---

export type AdminPolicyCapPatch = { section: string; action: string };

export type SimulateMatrixImpactBody = {
  position_id: number;
  patch: {
    added?: AdminPolicyCapPatch[];
    removed?: AdminPolicyCapPatch[];
  };
  include_break_glass?: boolean;
  limit?: number;
};

export type MatrixImpactSampleUser = {
  user_id: string;
  email: string;
  display_name: string;
  caps_removed: string[];
  caps_added: string[];
  menu_items_lost: string[];
};

export type MatrixImpactResult = {
  position_code: string;
  affected_user_count: number;
  sample_users: MatrixImpactSampleUser[];
  aggregate: {
    caps_removed_unique: string[];
    users_with_pii_loss: number;
  };
  elapsed_ms: number;
};

export async function simulateMatrixImpact(
  token: string,
  body: SimulateMatrixImpactBody,
): Promise<MatrixImpactResult> {
  return crmFetch(token, '/api/v1/admin/policy/simulate-impact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type AdminPolicyRow = {
  id: string;
  description: string;
  enabled: boolean;
  rego_preview?: string;
  bundle_version?: string;
};

export async function fetchAdminPolicies(
  token: string,
): Promise<{ policies: AdminPolicyRow[]; bundle_version?: string }> {
  return crmFetch(token, '/api/v1/admin/policies');
}

export async function fetchAdminPolicy(
  token: string,
  id: string,
): Promise<{ policy: AdminPolicyRow; rego_text: string }> {
  return crmFetch(token, `/api/v1/admin/policies/${encodeURIComponent(id)}`);
}

export async function patchAdminPolicy(
  token: string,
  id: string,
  body: { description?: string; enabled?: boolean },
): Promise<{ policy: AdminPolicyRow }> {
  return crmFetch(token, `/api/v1/admin/policies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function exportAdminPolicyBundle(token: string): Promise<void> {
  await downloadBinary(token, '/api/v1/admin/policies/export-bundle', 'opa-bundle.zip');
}

export async function validateAdminPolicyBundle(
  token: string,
): Promise<{ ok: boolean; errors?: string[]; bundle_version?: string }> {
  return crmFetch(token, '/api/v1/admin/policies/validate', { method: 'POST' });
}

export type AdminEnvSnapshotRow = {
  id: string;
  label: string;
  snapshot_type: string;
  created_at: string;
  signed_by?: string;
};

export async function fetchAdminEnvSnapshots(
  token: string,
): Promise<{ snapshots: AdminEnvSnapshotRow[] }> {
  return crmFetch(token, '/api/v1/admin/environments/snapshots');
}

export type AdminEnvDiffBody = {
  left_snapshot_id?: string;
  right_snapshot_id?: string;
  upload_json?: unknown;
};

export type AdminEnvDiffResult = {
  id: string;
  summary: { added: number; removed: number; changed: number };
  matrix_diff: Array<{ position_code: string; added: string[]; removed: string[] }>;
  org_diff?: Array<{ entity: string; field: string; from: unknown; to: unknown }>;
  severity: 'info' | 'warning' | 'critical';
};

export async function createAdminEnvDiff(
  token: string,
  body: AdminEnvDiffBody,
): Promise<AdminEnvDiffResult> {
  return crmFetch(token, '/api/v1/admin/environments/diff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchAdminEnvDiff(token: string, id: string): Promise<AdminEnvDiffResult> {
  return crmFetch(token, `/api/v1/admin/environments/diff/${encodeURIComponent(id)}`);
}

export type AdminAiPolicyRow = {
  agent_code: string;
  agent_name?: string;
  allowed_tools: string[];
  spend_cap_usd_monthly: number | null;
  pii_block_fields: string[];
  require_human_approval: boolean;
  updated_by?: string;
  updated_at?: string;
};

export async function fetchAdminAiPolicies(
  token: string,
): Promise<{ policies: AdminAiPolicyRow[]; agents_missing_policy?: number }> {
  return crmFetch(token, '/api/v1/admin/ai/policies');
}

export async function patchAdminAiPolicy(
  token: string,
  agentCode: string,
  body: Partial<
    Pick<AdminAiPolicyRow, 'allowed_tools' | 'spend_cap_usd_monthly' | 'pii_block_fields' | 'require_human_approval'>
  >,
): Promise<{ policy: AdminAiPolicyRow }> {
  return crmFetch(token, `/api/v1/admin/ai/policies/${encodeURIComponent(agentCode)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type AdminChangeRequest = {
  id: string;
  kind: string;
  entity_key: string;
  patch_json: Record<string, unknown>;
  impact_json?: Record<string, unknown> | null;
  status: 'draft' | 'pending' | 'approved' | 'applied' | 'rejected';
  requester_email: string;
  approver_email?: string | null;
  approver_note?: string | null;
  applied_at?: string | null;
  created_at: string;
};

export async function fetchChangeRequests(
  token: string,
  params?: { status?: string },
): Promise<{ requests: AdminChangeRequest[]; pending_count?: number }> {
  const qs = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return crmFetch(token, `/api/v1/admin/change-requests${qs}`);
}

export async function createChangeRequest(
  token: string,
  body: {
    kind?: string;
    entity_key: string;
    patch_json: Record<string, unknown>;
    impact_json?: Record<string, unknown>;
  },
): Promise<{ request: AdminChangeRequest }> {
  return crmFetch(token, '/api/v1/admin/change-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function submitChangeRequest(
  token: string,
  id: string,
): Promise<{ request: AdminChangeRequest }> {
  return crmFetch(token, `/api/v1/admin/change-requests/${encodeURIComponent(id)}/submit`, {
    method: 'POST',
  });
}

export async function approveChangeRequest(
  token: string,
  id: string,
  body?: { note?: string },
): Promise<{ request: AdminChangeRequest }> {
  return crmFetch(token, `/api/v1/admin/change-requests/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export async function rejectChangeRequest(
  token: string,
  id: string,
  body: { note?: string },
): Promise<{ request: AdminChangeRequest }> {
  return crmFetch(token, `/api/v1/admin/change-requests/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type CompliancePackRow = {
  code: string;
  label: string;
  description: string;
};

export async function fetchCompliancePacks(
  token: string,
): Promise<{ packs: CompliancePackRow[] }> {
  return crmFetch(token, '/api/v1/admin/compliance-packs');
}

export async function previewCompliancePack(
  token: string,
  code: string,
): Promise<{
  code: string;
  summary: { added: number; removed: number; changed: number };
  matrix_diff: Array<{ position_code: string; added: string[]; removed: string[] }>;
}> {
  return crmFetch(token, `/api/v1/admin/compliance-packs/${encodeURIComponent(code)}/preview`);
}

export async function applyCompliancePack(
  token: string,
  code: string,
  body?: { dry_run?: boolean },
): Promise<{ ok: boolean; change_request_id?: string; applied?: boolean }> {
  return crmFetch(token, `/api/v1/admin/compliance-packs/${encodeURIComponent(code)}/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
}

export type ServiceAccountRow = {
  id: string;
  name: string;
  key_prefix: string;
  scoped_caps: AdminPolicyCapPatch[];
  active: boolean;
  expires_at?: string | null;
  created_by: string;
  created_at: string;
  last_used_at?: string | null;
};

export async function fetchServiceAccounts(
  token: string,
): Promise<{ accounts: ServiceAccountRow[] }> {
  return crmFetch(token, '/api/v1/admin/service-accounts');
}

export async function createServiceAccount(
  token: string,
  body: { name: string; scoped_caps?: AdminPolicyCapPatch[]; expires_at?: string },
): Promise<{ account: ServiceAccountRow; plain_key: string }> {
  return crmFetch(token, '/api/v1/admin/service-accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function rotateServiceAccount(
  token: string,
  id: string,
): Promise<{ account: ServiceAccountRow; plain_key: string }> {
  return crmFetch(token, `/api/v1/admin/service-accounts/${encodeURIComponent(id)}/rotate`, {
    method: 'POST',
  });
}

export async function revokeServiceAccount(
  token: string,
  id: string,
): Promise<{ ok: boolean }> {
  return crmFetch(token, `/api/v1/admin/service-accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export type LegalEntityRow = {
  id: number;
  code: string;
  name: string;
  tax_id?: string | null;
  country_code?: string;
  active: boolean;
};

export async function fetchLegalEntities(
  token: string,
): Promise<{ entities: LegalEntityRow[] }> {
  return crmFetch(token, '/api/v1/admin/org/legal-entities');
}

export async function createLegalEntity(
  token: string,
  body: { code: string; name: string; tax_id?: string; country_code?: string },
): Promise<{ entity: LegalEntityRow }> {
  return crmFetch(token, '/api/v1/admin/org/legal-entities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type OrgBranchRow = {
  id: number;
  legal_entity_id: number;
  code: string;
  name: string;
  active: boolean;
};

export async function fetchOrgBranches(
  token: string,
  legalEntityId?: number,
): Promise<{ branches: OrgBranchRow[] }> {
  const qs =
    legalEntityId != null ? `?legal_entity_id=${encodeURIComponent(String(legalEntityId))}` : '';
  return crmFetch(token, `/api/v1/admin/org/branches${qs}`);
}

export async function createOrgBranch(
  token: string,
  body: { legal_entity_id: number; code: string; name: string },
): Promise<{ branch: OrgBranchRow }> {
  return crmFetch(token, '/api/v1/admin/org/branches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
