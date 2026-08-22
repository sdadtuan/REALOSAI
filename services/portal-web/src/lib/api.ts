import { capacitorClientHeaders } from '@/lib/capacitor';

export const API_BASE =
  (process.env.NEXT_PUBLIC_PTT_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

export interface PortalUser {
  id: string;
  email: string;
  client_id: string;
  role: string;
}

export interface PerformanceRow {
  performance_date?: string | null;
  channel?: string | null;
  external_campaign_id: string | null;
  external_campaign_name: string | null;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  leads_crm: number;
  leads_platform: number;
  cpl: number | null;
  target_cpl_vnd: number | null;
  cpl_delta_vnd: number | null;
  cpl_delta_pct: number | null;
  conversion_value: number;
  roas: number | null;
  roas_stub: boolean;
  hub_mapped: boolean;
  synced_at: string | null;
}

export interface PerformanceSummary {
  row_count: number;
  total_spend: number;
  total_leads_crm: number;
  avg_cpl: number | null;
  total_conversion_value: number;
  avg_roas: number | null;
  roas_stub: boolean;
  latest_performance_date: string | null;
  latest_synced_at: string | null;
  campaigns_tracked: number;
  mapped_rows: number;
  over_target_rows: number;
}

export type PerformanceChannel = 'meta' | 'google' | 'zalo';

export interface PerformanceDataFreshness {
  through_date: string;
  synced_at: string | null;
}

export interface PerformanceListResponse {
  ok: boolean;
  client_id: string;
  date_from: string;
  date_to: string;
  group_by: 'day' | 'campaign';
  channel?: PerformanceChannel | null;
  rows: PerformanceRow[];
  summary: PerformanceSummary;
  attribution_model?: 'last_touch_crm';
  unmapped_spend_pct?: number;
  spend_source?: 'meta_api';
  data_freshness?: PerformanceDataFreshness;
  error?: string;
}

export type CreativeStatus = 'pending_client' | 'approved' | 'rejected' | 'withdrawn';

export interface CreativeRow {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  external_campaign_id: string | null;
  external_campaign_name: string | null;
  version: number;
  asset_url: string | null;
  asset_type: string;
  status: CreativeStatus;
  submitted_by: string | null;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface CreativePendingResponse {
  ok: boolean;
  client_id: string;
  count: number;
  rows: CreativeRow[];
}

export interface CreativeDecisionResponse {
  ok: boolean;
  creative: CreativeRow;
  event_id: string | null;
  temporal_signal: 'sent' | 'stub' | 'skipped';
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in?: number;
  user: PortalUser;
}

export interface PortalSettingsResponse {
  ok: boolean;
  client_id: string;
  client_name: string | null;
  display_name: string | null;
  logo_url: string | null;
  am_contact_name: string | null;
  am_contact_email: string | null;
  accent_color: string | null;
  updated_at: string | null;
  table_ready: boolean;
}

export interface CreativeHistoryResponse {
  ok: boolean;
  client_id: string;
  days: number;
  count: number;
  rows: CreativeRow[];
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

export function isTenantArchivedError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  return err.message === 'tenant_archived' || err.status === 403;
}

export function tenantArchivedMessage(): string {
  return 'Client đã archived — portal không còn truy cập được.';
}

async function parseJson<T>(res: Response): Promise<T> {
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

export async function portalLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await parseJson<LoginResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Login failed', res.status);
  }
  return body;
}

export async function portalForgotPassword(
  email: string,
): Promise<{ ok: boolean; message: string; reset_url?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const body = await parseJson<{ ok: boolean; message: string; reset_url?: string; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Forgot password failed', res.status);
  }
  return body;
}

export async function portalValidateResetToken(
  token: string,
): Promise<{ ok: boolean; email_masked?: string; error?: string }> {
  const qs = new URLSearchParams({ token });
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/reset-password/validate?${qs.toString()}`, {
    cache: 'no-store',
  });
  return parseJson(res);
}

export async function portalResetPassword(token: string, password: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const body = await parseJson<{ ok: boolean; message?: string; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Reset password failed', res.status);
  }
  return body;
}

export async function portalChangePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const body = await parseJson<{ ok: boolean; message?: string; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Change password failed', res.status);
  }
  return body;
}

export async function portalRefresh(refreshToken: string): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const body = await parseJson<LoginResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Refresh failed', res.status);
  }
  return body;
}

export async function portalMe(token: string): Promise<PortalUser> {
  const res = await fetch(`${API_BASE}/api/v1/portal/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalUser & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Unauthorized', res.status);
  }
  return body;
}

export async function fetchNestHealth(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' });
  return parseJson(res);
}

export interface PublicDealTeaser {
  ok: true;
  project_name: string;
  client_name: string;
  service_slug: string;
  north_star: string;
  strategy_blocks: Array<{ key: string; label: string; content: string }>;
  account_manager_name: string | null;
  contact_cta: { mailto_href: string; label: string };
  expires_at: string;
}

export async function fetchPublicDealTeaser(token: string): Promise<PublicDealTeaser> {
  const res = await fetch(`${API_BASE}/api/portal/deal-teaser/${encodeURIComponent(token)}`, {
    cache: 'no-store',
  });
  const body = await parseJson<PublicDealTeaser & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Teaser unavailable', res.status);
  }
  return body;
}

export interface PublicVideoReview {
  token: string;
  project_id: number;
  gate_no: number;
  expires_at: string;
  watermark_label: string;
  watermark_text: string;
  video_url: string;
  asset_ids: number[];
  comments: Array<{
    id: number;
    body: string;
    timecode_ms: number | null;
    pin_x: number | null;
    pin_y: number | null;
    created_at: string;
  }>;
}

async function publicVdReviewFetch<T>(
  token: string,
  pathSuffix: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(
    `${API_BASE}/api/v1/public/vd/review/${encodeURIComponent(token)}${pathSuffix}`,
    { cache: 'no-store', ...init },
  );
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Review unavailable', res.status);
  }
  return body;
}

export async function fetchPublicVideoReview(token: string): Promise<PublicVideoReview> {
  return publicVdReviewFetch<PublicVideoReview>(token, '');
}

export async function postPublicVideoReviewComment(
  token: string,
  body: { body: string; timecode_ms?: number },
): Promise<unknown> {
  return publicVdReviewFetch(token, '/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function approvePublicVideoReview(token: string): Promise<unknown> {
  return publicVdReviewFetch(token, '/approve', { method: 'POST', body: JSON.stringify({}) });
}

export async function requestPublicVideoReviewChanges(
  token: string,
  body: { reason?: string },
): Promise<unknown> {
  return publicVdReviewFetch(token, '/request-changes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchPerformance(
  token: string,
  params?: { from?: string; to?: string; group_by?: 'day' | 'campaign'; channel?: PerformanceChannel },
): Promise<PerformanceListResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.group_by) qs.set('group_by', params.group_by);
  if (params?.channel) qs.set('channel', params.channel);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/performance${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PerformanceListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Performance fetch failed', res.status);
  }
  return body;
}

export async function fetchCreativeHistory(
  token: string,
  days = 30,
): Promise<CreativeHistoryResponse> {
  const res = await fetch(`${API_BASE}/api/v1/creatives/history?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<CreativeHistoryResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Creative history fetch failed', res.status);
  }
  return body;
}

export async function fetchPendingCreativeCount(token: string): Promise<number> {
  const res = await fetch(`${API_BASE}/api/v1/creatives/pending/count`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ ok?: boolean; count?: number; error?: string }>(res);
  if (!res.ok) {
    return 0;
  }
  return Number(body.count ?? 0);
}

export async function fetchPortalSettings(token: string): Promise<PortalSettingsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/settings`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalSettingsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Settings fetch failed', res.status);
  }
  return body;
}

export async function patchPortalSettings(
  token: string,
  input: Partial<
    Pick<
      PortalSettingsResponse,
      'display_name' | 'logo_url' | 'am_contact_name' | 'am_contact_email' | 'accent_color'
    >
  >,
): Promise<PortalSettingsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/settings`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });
  const body = await parseJson<PortalSettingsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Settings update failed', res.status);
  }
  return body;
}

export function performanceExportUrl(params?: {
  from?: string;
  to?: string;
  group_by?: 'day' | 'campaign';
  channel?: PerformanceChannel;
  format?: 'csv' | 'pdf';
}): string {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.group_by) qs.set('group_by', params.group_by);
  if (params?.channel) qs.set('channel', params.channel);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const ext = params?.format === 'pdf' ? 'export.pdf' : 'export.csv';
  return `${API_BASE}/api/v1/performance/${ext}${suffix}`;
}

export async function fetchPendingCreatives(token: string): Promise<CreativePendingResponse> {
  const res = await fetch(`${API_BASE}/api/v1/creatives/pending`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<CreativePendingResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Creative inbox fetch failed', res.status);
  }
  return body;
}

export async function approveCreative(
  token: string,
  creativeId: string,
): Promise<CreativeDecisionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/creatives/${creativeId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<CreativeDecisionResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Approve failed', res.status);
  }
  return body;
}

export async function rejectCreative(
  token: string,
  creativeId: string,
  note?: string,
): Promise<CreativeDecisionResponse> {
  const res = await fetch(`${API_BASE}/api/v1/creatives/${creativeId}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: note?.trim() || undefined }),
  });
  const body = await parseJson<CreativeDecisionResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Reject failed', res.status);
  }
  return body;
}

export interface PortalSeoSummaryResponse {
  seo_enabled: boolean;
  customer_id?: number;
  pending_client_review?: number;
  executive?: Record<string, unknown>;
  error?: string;
}

export interface PortalSeoWidgetMetric {
  label: string;
  value: unknown;
  unit?: string;
  sparkline?: number[];
}

export interface PortalSeoWidgetsResponse {
  ok: boolean;
  customer_id: number;
  widgets: Record<string, PortalSeoWidgetMetric>;
}

export type PortalSeoReportType = 'executive' | 'seo' | 'aeo' | 'technical' | 'content';

export interface PortalSeoExecutiveReportResponse {
  ok: boolean;
  customer_id: number;
  dashboard_type: PortalSeoReportType;
  report: Record<string, unknown>;
  generated_at: string;
}

export interface PortalSeoStatusResponse {
  ok: boolean;
  enabled: boolean;
  mapped: boolean;
  customer_id?: number;
  pending_client_review?: number;
}

export async function portalSeoSummary(token: string): Promise<PortalSeoSummaryResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalSeoSummaryResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'SEO summary failed', res.status);
  }
  return body;
}

export async function portalSeoStatus(token: string): Promise<PortalSeoStatusResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/status`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalSeoStatusResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'SEO status failed', res.status);
  }
  return body;
}

export async function portalSeoWidgets(token: string): Promise<PortalSeoWidgetsResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/widgets`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalSeoWidgetsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'SEO widgets failed', res.status);
  }
  return body;
}

export async function portalSeoExecutiveReport(
  token: string,
  type: PortalSeoReportType = 'executive',
): Promise<PortalSeoExecutiveReportResponse> {
  const qs = type !== 'executive' ? `?type=${encodeURIComponent(type)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/reports/executive${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalSeoExecutiveReportResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Executive report failed', res.status);
  }
  return body;
}

export async function portalSeoPendingContent(
  token: string,
): Promise<{ ok: boolean; items: Array<{ id: number; title: string; content_type: string }> }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/content/pending`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<
    { ok: boolean; items: Array<{ id: number; title: string; content_type: string }> } & {
      error?: string;
      message?: string;
    }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Pending content failed', res.status);
  }
  return body;
}

export async function portalSeoContentDetail(
  token: string,
  contentId: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/content/${encodeURIComponent(contentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<Record<string, unknown> & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Content detail failed', res.status);
  }
  return body;
}

export async function portalSeoReviewContent(
  token: string,
  contentId: string,
  payload: { approved: boolean; notes?: string },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/api/v1/portal/seo/content/${encodeURIComponent(contentId)}/review`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJson<Record<string, unknown> & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Review failed', res.status);
  }
  return body;
}

export interface PortalEmailDashboard {
  ok: boolean;
  email_enabled: boolean;
  client_id: string;
  pending_approvals: number;
  campaigns_sent_28d: number;
  open_rate_pct: number;
  revenue_attrib: number;
  recent_campaigns: Array<{
    id: string;
    name: string;
    status: string;
    audience_count: number | null;
    updated_at: string;
  }>;
}

export interface PortalEmailApprovalRow {
  campaign_id: string;
  name: string;
  audience_count: number | null;
  template_name: string;
  requested_at: string;
  status: string;
}

export interface PortalEmailApprovalPreview {
  ok: boolean;
  campaign_id: string;
  name: string;
  subject_template: string;
  html_body: string;
  audience_count: number | null;
  scheduled_at: string | null;
  template_name: string;
  status: string;
}

export interface PortalEmailCampaignStats {
  ok: boolean;
  campaign_id: string;
  campaign_name: string;
  status: string;
  audience_count: number | null;
  sent: number;
  opens: number;
  clicks: number;
  open_rate_pct: number;
  click_rate_pct: number;
  revenue_attrib: number;
}

export async function portalEmailDashboard(token: string): Promise<PortalEmailDashboard> {
  const res = await fetch(`${API_BASE}/api/v1/portal/email/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalEmailDashboard & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Email dashboard failed', res.status);
  }
  return body;
}

export async function portalEmailPendingApprovals(
  token: string,
): Promise<{ ok: boolean; items: PortalEmailApprovalRow[] }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/email/approvals/pending`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<
    { ok: boolean; items: PortalEmailApprovalRow[] } & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Pending approvals failed', res.status);
  }
  return body;
}

export async function portalEmailApprovalPreview(
  token: string,
  campaignId: string,
): Promise<PortalEmailApprovalPreview> {
  const res = await fetch(
    `${API_BASE}/api/v1/portal/email/approvals/${encodeURIComponent(campaignId)}/preview`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  const body = await parseJson<PortalEmailApprovalPreview & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Approval preview failed', res.status);
  }
  return body;
}

export async function portalEmailApproveCampaign(
  token: string,
  campaignId: string,
): Promise<{ ok: boolean; campaign: { id: string; status: string; name: string } }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/email/approvals/${encodeURIComponent(campaignId)}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<
    { ok: boolean; campaign: { id: string; status: string; name: string } } & {
      error?: string;
      message?: string;
    }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Approve failed', res.status);
  }
  return body;
}

export async function portalEmailRejectCampaign(
  token: string,
  campaignId: string,
  note?: string,
): Promise<{ ok: boolean; campaign: { id: string; status: string; name: string } }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/email/approvals/${encodeURIComponent(campaignId)}/reject`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ note: note?.trim() || undefined }),
  });
  const body = await parseJson<
    { ok: boolean; campaign: { id: string; status: string; name: string } } & {
      error?: string;
      message?: string;
    }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Reject failed', res.status);
  }
  return body;
}

export async function portalEmailCampaignStats(
  token: string,
  campaignId: string,
): Promise<PortalEmailCampaignStats> {
  const res = await fetch(`${API_BASE}/api/v1/portal/email/campaigns/${encodeURIComponent(campaignId)}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalEmailCampaignStats & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Campaign stats failed', res.status);
  }
  return body;
}

export interface PortalNotificationRow {
  id: string;
  client_id: string;
  category: string;
  title: string;
  body: string | null;
  link_url: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
  meta?: Record<string, unknown>;
}

export interface PortalNotificationListResponse {
  ok: boolean;
  client_id: string;
  count: number;
  unread: number;
  rows: PortalNotificationRow[];
  table_ready: boolean;
}

export interface PortalNotificationSummaryResponse {
  ok: boolean;
  client_id: string;
  unread: number;
  pending_creatives: number;
  pending_email: number;
  pending_seo: number;
  table_ready: boolean;
}

export async function fetchPortalNotifications(
  token: string,
  params?: { unreadOnly?: boolean; limit?: number },
): Promise<PortalNotificationListResponse> {
  const qs = new URLSearchParams();
  if (params?.unreadOnly) qs.set('unread_only', '1');
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/portal/notifications${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalNotificationListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Notifications fetch failed', res.status);
  }
  return body;
}

export async function fetchPortalNotificationSummary(
  token: string,
): Promise<PortalNotificationSummaryResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/notifications/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalNotificationSummaryResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Notification summary failed', res.status);
  }
  return body;
}

export async function markPortalNotificationRead(
  token: string,
  notificationId: string,
): Promise<{ ok: boolean; notification: PortalNotificationRow }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<
    { ok: boolean; notification: PortalNotificationRow } & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Mark read failed', res.status);
  }
  return body;
}

export async function markAllPortalNotificationsRead(
  token: string,
): Promise<{ ok: boolean; updated: number }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<{ ok: boolean; updated: number; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Mark all read failed', res.status);
  }
  return body;
}

export interface PortalAiReportSummaryResponse {
  ok: boolean;
  client_id: string;
  enabled: boolean;
  period: {
    from: string;
    to: string;
    label: string;
    days: number;
  };
  narrative: string;
  bullets: string[];
  kpis: {
    total_spend: number;
    total_leads_crm: number;
    avg_cpl: number | null;
    avg_roas: number | null;
    campaigns_tracked: number;
    over_target_rows: number;
    unmapped_spend_pct: number;
  };
  channels: Array<{
    channel: 'meta' | 'google' | 'zalo';
    spend: number;
    leads_crm: number;
    avg_cpl: number | null;
  }>;
  data_freshness?: {
    through_date: string;
    synced_at: string | null;
  } | null;
  generated_at: string;
  stub_mode: boolean;
  agent_run_id?: string | null;
  error?: string;
}

export async function fetchPortalAiReportSummary(
  token: string,
  params?: { days?: number },
): Promise<PortalAiReportSummaryResponse> {
  const qs = new URLSearchParams();
  if (params?.days) {
    qs.set('days', String(params.days));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/portal/ai/report-summary${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalAiReportSummaryResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal AI summary failed', res.status);
  }
  return body;
}

export interface MktAiPortalLinkedLifecycle {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number | null;
  service_slug: string | null;
  stage: string | null;
}

export interface MktAiPortalPlanSummary {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  brand_name: string | null;
  quality_score: number | null;
  playbook_label: string | null;
  strategy_excerpt: string;
  campaign_count: number;
  last_updated_at: string;
  staff_planner_url: string;
}

export async function fetchPortalMktAiLinkedLifecycle(
  token: string,
): Promise<MktAiPortalLinkedLifecycle> {
  const res = await fetch(`${API_BASE}/api/v1/portal/service-lifecycle/linked`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<MktAiPortalLinkedLifecycle & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal MKT-AI linked lifecycle failed', res.status);
  }
  return body;
}

export async function fetchPortalMktAiPlanSummary(
  token: string,
  lifecycleId: number,
): Promise<MktAiPortalPlanSummary> {
  const res = await fetch(
    `${API_BASE}/api/v1/portal/service-lifecycle/${lifecycleId}/ai-planner/summary`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  const body = await parseJson<MktAiPortalPlanSummary & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal MKT-AI plan summary failed', res.status);
  }
  return body;
}

export type OpsPortalLinkedLifecycle = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number | null;
  service_slug: string | null;
  dv_code: string | null;
  stage: string | null;
};

export type OpsPortalSummary = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  dv_code: string;
  dv_name: string;
  stage: string;
  package_tier: string;
  iso_week: string;
  weekly: {
    spawned: boolean;
    tasks_done: number;
    tasks_total: number;
    progress_pct: number;
  };
  kpi: {
    period_type: 'month';
    period_key: string;
    overall_label: 'Dat' | 'CanChuY' | 'KhongDat' | null;
    metrics: Array<{
      key: string;
      label: string;
      status_label: 'Dat' | 'CanChuY' | 'KhongDat';
      progress_pct: number | null;
    }>;
  };
  status_message_vi: string;
};

export async function fetchPortalOpsLinkedLifecycle(
  token: string,
): Promise<OpsPortalLinkedLifecycle> {
  const res = await fetch(`${API_BASE}/api/v1/portal/ops/linked`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<OpsPortalLinkedLifecycle & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal ops linked lifecycle failed', res.status);
  }
  return body;
}

export async function fetchPortalOpsLifecycleSummary(
  token: string,
  lifecycleId: number,
): Promise<OpsPortalSummary> {
  const res = await fetch(`${API_BASE}/api/v1/portal/ops/lifecycle/${lifecycleId}/summary`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<OpsPortalSummary & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal ops summary failed', res.status);
  }
  return body;
}

export type CmktPortalContentSummary = {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  service_slug: string;
  items_by_status: Record<string, number>;
  pending_client_count: number;
  published_mtd: number;
  pending_items: Array<{
    id: number;
    title: string;
    channel: string;
    format: string;
    status: string;
    updated_at: string;
  }>;
  staff_content_url: string;
};

export async function fetchPortalCmktContentSummary(
  token: string,
  lifecycleId: number,
): Promise<CmktPortalContentSummary> {
  const res = await fetch(
    `${API_BASE}/api/v1/portal/service-lifecycle/${lifecycleId}/content-summary`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );
  const body = await parseJson<CmktPortalContentSummary & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal content summary failed', res.status);
  }
  return body;
}

export async function postPortalCmktClientApprove(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean }> {
  const res = await fetch(
    `${API_BASE}/api/v1/portal/service-lifecycle/${lifecycleId}/content-marketing/items/${itemId}/client-approve`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  const body = await parseJson<{ ok?: boolean; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Portal client approve failed', res.status);
  }
  return { ok: Boolean(body.ok) };
}

export interface PortalPushVapidResponse {
  ok: boolean;
  enabled: boolean;
  public_key: string | null;
}

export interface PortalPushSubscribeResponse {
  ok: boolean;
  table_ready: boolean;
  subscription_id: string | null;
  endpoint: string;
}

export async function fetchPortalPushVapidPublicKey(): Promise<PortalPushVapidResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/push/vapid-public-key`, { cache: 'no-store' });
  const body = await parseJson<PortalPushVapidResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'VAPID key fetch failed', res.status);
  }
  return body;
}

export async function subscribePortalPush(
  token: string,
  subscription: PushSubscriptionJSON,
): Promise<PortalPushSubscribeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/push/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    }),
  });
  const body = await parseJson<PortalPushSubscribeResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Push subscribe failed', res.status);
  }
  return body;
}

export async function unsubscribePortalPush(token: string, endpoint: string): Promise<{ ok: boolean }> {
  const qs = new URLSearchParams({ endpoint });
  const res = await fetch(`${API_BASE}/api/v1/portal/push/subscribe?${qs.toString()}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await parseJson<{ ok: boolean; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Push unsubscribe failed', res.status);
  }
  return body;
}

export interface PortalPushTestResponse {
  ok: boolean;
  table_ready: boolean;
  subscription_count: number;
  send_status: string;
  sent?: number;
  failed?: number;
  message?: string;
  errors?: string[];
}

export async function testPortalPush(token: string): Promise<PortalPushTestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/portal/push/test`, {
    method: 'POST',
    headers: capacitorClientHeaders({ Authorization: `Bearer ${token}` }),
  });
  const body = await parseJson<PortalPushTestResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Push test failed', res.status);
  }
  return body;
}

export interface MobileConfigResponse {
  ok: boolean;
  min_version: string;
  force_update: boolean;
  native_push_enabled: boolean;
  fcm_configured: boolean;
  portal_url: string;
  deep_link_scheme: string;
}

export interface NativeDeviceRegisterResponse {
  ok: boolean;
  device_id: string | null;
  platform: string;
}

export interface NativePushTestResponse {
  ok: boolean;
  configured: boolean;
  sent: number;
  failed: number;
  errors: string[];
  message?: string;
}

export async function fetchMobileConfig(appVersion?: string): Promise<MobileConfigResponse> {
  const res = await fetch(`${API_BASE}/api/v1/mobile/config`, {
    cache: 'no-store',
    headers: capacitorClientHeaders(
      appVersion ? { 'X-PTT-App-Version': appVersion } : undefined,
    ),
  });
  const body = await parseJson<MobileConfigResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Mobile config fetch failed', res.status);
  }
  return body;
}

export async function registerNativeDeviceToken(
  token: string,
  payload: {
    token: string;
    platform?: string;
    app_version?: string;
    user_agent?: string;
  },
): Promise<NativeDeviceRegisterResponse> {
  const res = await fetch(`${API_BASE}/api/v1/mobile/device-token`, {
    method: 'POST',
    headers: capacitorClientHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(payload),
  });
  const body = await parseJson<NativeDeviceRegisterResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Native device register failed', res.status);
  }
  return body;
}

export async function unregisterNativeDeviceToken(
  token: string,
  deviceToken: string,
): Promise<{ ok: boolean; removed: boolean }> {
  const qs = new URLSearchParams({ token: deviceToken });
  const res = await fetch(`${API_BASE}/api/v1/mobile/device-token?${qs.toString()}`, {
    method: 'DELETE',
    headers: capacitorClientHeaders({ Authorization: `Bearer ${token}` }),
  });
  const body = await parseJson<{ ok: boolean; removed: boolean; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Native device unregister failed', res.status);
  }
  return body;
}

export type PortalResearchReportCard = {
  version_id: number;
  version: number;
  as_of: string | null;
  expires_at: string | null;
  watermark: string;
  has_stale_insights?: boolean;
};

export type PortalResearchReportDetail = PortalResearchReportCard & {
  exec: { vi: string; en: string | null };
  findings: unknown[];
  recs: unknown[];
  methodology: unknown;
  evidence_index: unknown[];
};

export async function portalResearchReports(
  token: string,
  input?: { stale_only?: boolean },
): Promise<{ items: PortalResearchReportCard[] }> {
  const qs = new URLSearchParams();
  if (input?.stale_only) qs.set('stale_only', '1');
  const suffix = qs.size ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/portal/research/reports${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ items: PortalResearchReportCard[] } & { error?: string; message?: string }>(
    res,
  );
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Research reports failed', res.status);
  }
  return body;
}

export async function portalResearchReport(
  token: string,
  versionId: number,
): Promise<PortalResearchReportDetail> {
  const res = await fetch(`${API_BASE}/api/v1/portal/research/reports/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalResearchReportDetail & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Research report failed', res.status);
  }
  return body;
}

export async function portalResearchReportPdf(token: string, versionId: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/v1/portal/research/reports/${versionId}/export.pdf`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'Research PDF failed', res.status);
  }
  return res.blob();
}

export async function portalResearchHealth(token: string): Promise<{
  ok: true;
  enabled: true;
  rag_enabled: boolean;
  rag_openai_embed_enabled: boolean;
  rag_embed_model: 'openai' | 'local';
}> {
  const res = await fetch(`${API_BASE}/api/v1/portal/research/health`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    ok: true;
    enabled: true;
    rag_enabled: boolean;
    rag_openai_embed_enabled: boolean;
    rag_embed_model: 'openai' | 'local';
    error?: string;
    message?: string;
  }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Research health failed', res.status);
  }
  return body;
}

export type PortalResearchRagHit = {
  insight_id: number;
  project_id: number;
  statement: string;
  status: 'published';
  score: number;
  theme_codes: string[];
  valid_to?: string | null;
  is_stale?: boolean;
};

export async function portalResearchInsightSearch(
  token: string,
  input: { q: string; theme_code?: string; limit?: number; stale_only?: boolean },
): Promise<{ hits: PortalResearchRagHit[]; note?: string }> {
  const qs = new URLSearchParams({ q: input.q });
  if (input.theme_code) qs.set('theme_code', input.theme_code);
  if (input.limit) qs.set('limit', String(input.limit));
  if (input.stale_only) qs.set('stale_only', '1');
  const res = await fetch(`${API_BASE}/api/v1/portal/research/insights/search?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{ hits: PortalResearchRagHit[]; note?: string; error?: string; message?: string }>(
    res,
  );
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Research search failed', res.status);
  }
  return body;
}

export type PortalThemeQuarterAnalyticsPayload = {
  ok: true;
  year: number;
  client_id: string;
  corpus_statuses: readonly string[];
  rows: Array<{
    quarter: number;
    theme_code: string;
    label_vi: string;
    insight_count: number;
    prev_qoq_count?: number | null;
    prev_yoy_count?: number | null;
    delta_qoq_pct?: number | null;
    delta_yoy_pct?: number | null;
  }>;
};

export type PortalCjSummary = {
  n: number;
  n_choices: number;
  attributes: Array<{
    name: string;
    levels: Array<{ label: string; count: number; share_pct: number }>;
    top_level: string | null;
  }>;
  recommendation: { levels: Array<{ attribute: string; level: string; share_pct: number }> };
  limitation_note: string;
  statistical_inference: false;
};

export async function portalResearchConjoint(
  token: string,
): Promise<{ summary: PortalCjSummary | null }> {
  const res = await fetch(`${API_BASE}/api/v1/portal/research/conjoint`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<{
    summary: PortalCjSummary | null;
    error?: string;
    message?: string;
  }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Conjoint lite failed', res.status);
  }
  return body;
}

export async function portalResearchThemeQuarterAnalytics(
  token: string,
  params?: { year?: number },
): Promise<PortalThemeQuarterAnalyticsPayload> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/portal/research/analytics/themes${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await parseJson<PortalThemeQuarterAnalyticsPayload & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Theme analytics failed', res.status);
  }
  return body;
}

export async function testNativePush(token: string): Promise<NativePushTestResponse> {
  const res = await fetch(`${API_BASE}/api/v1/mobile/push/test`, {
    method: 'POST',
    headers: capacitorClientHeaders({ Authorization: `Bearer ${token}` }),
  });
  const body = await parseJson<NativePushTestResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Native push test failed', res.status);
  }
  return body;
}
