import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface AiHealthData {
  status: string;
  copilot_enabled?: boolean;
  schema_ready?: boolean;
}

export interface AiScoreFactor {
  key: string;
  label: string;
  delta: number;
  sign: '+' | '-';
}

export interface AiExplainability {
  factors: AiScoreFactor[];
  flags: string[];
  score_band: 'hot' | 'warm' | 'cold';
}

export interface AiScoreRecord {
  id: string;
  score_value: number;
  confidence: number | null;
  explainability_json: AiExplainability;
  model_name: string | null;
  model_version?: string;
  calculated_at: string;
  overridden_by?: string | null;
  override_reason?: string | null;
  overridden_at?: string | null;
}

export interface AiScoresListResponse {
  data: {
    entity_type: string;
    entity_id: string;
    scores: AiScoreRecord[];
    latest: AiScoreRecord | null;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface AiScoresBatchResponse {
  data: {
    entity_type: string;
    scores_by_entity_id: Record<string, AiScoreRecord>;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface LeadScoreSummary {
  score_value: number;
  score_band: 'hot' | 'warm' | 'cold';
  confidence: number | null;
}

export interface AiSummarizeExtracted {
  intent: string | null;
  objections: string[];
  next_action: string | null;
  source: string | null;
  campaign_id: string | null;
  risk_flags: string[];
  budget_vnd: number | null;
}

export interface AiSummarizeResponse {
  data: {
    context: 'lead_brief' | 'activity';
    entity_type: string | null;
    entity_id: string | null;
    summary: string;
    bullets: string[];
    extracted: AiSummarizeExtracted;
    confidence: number;
    agent_run_id: string;
    model: string;
    stub_mode: boolean;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: unknown[];
}

export type SummarizeContext = 'lead_brief' | 'activity';

export type FollowUpChannelHint = 'zalo' | 'email' | 'note';

export type RecommendationStatus = 'pending' | 'accepted' | 'dismissed' | 'executed' | 'expired';

export interface AiRecommendationResponse {
  data: {
    id: string;
    recommendation_type: string;
    entity_type: string;
    entity_id: string;
    text: string;
    channel_hint: FollowUpChannelHint;
    subject?: string | null;
    confidence: number;
    status: RecommendationStatus;
    agent_run_id: string;
    stub_mode: boolean;
    activity_id?: number;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: unknown[];
}

export interface AiRecommendationListResponse {
  data: {
    entity_type: string;
    entity_id: string;
    recommendations: Array<{
      id: string;
      recommendation_type?: string;
      recommendation_text: string;
      status: RecommendationStatus;
      action_json?: Record<string, unknown>;
      confidence: number | null;
      agent_run_id?: string | null;
      created_at: string;
    }>;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAiHealth(token?: string): Promise<AiHealthData> {
  const headers: HeadersInit = token ? authHeaders(token) : {};
  const res = await fetch(`${API_BASE}/api/v1/ai/health`, { headers, cache: 'no-store' });
  const body = await parseJson<{ data: AiHealthData; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'AI health failed', res.status);
  }
  return body.data ?? (body as unknown as AiHealthData);
}

export async function fetchAiScores(
  token: string,
  entityType: string,
  entityId: string | number,
  limit = 5,
): Promise<AiScoresListResponse> {
  const qs = new URLSearchParams({
    entity_type: entityType,
    entity_id: String(entityId),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/api/v1/ai/scores?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiScoresListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Fetch scores failed', res.status);
  }
  return body;
}

/** AI-UC-006 / UI-R1-08 — GDKD manual score override. */
export interface ScoreLeadOverrideData {
  score_id: string;
  lead_id: number;
  score: number;
  confidence: number;
  score_band: 'hot' | 'warm' | 'cold';
  explainability: AiExplainability;
  model_name: string;
  calculated_at: string;
}

export interface ScoreLeadOverrideResponse {
  data: ScoreLeadOverrideData;
  meta: { request_id: string };
  errors: unknown[];
}

export async function postAiScoreOverride(
  token: string,
  input: { lead_id: number; score: number; override_reason: string },
): Promise<ScoreLeadOverrideResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/scores/lead/override`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<ScoreLeadOverrideResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Override score failed', res.status);
  }
  return body;
}

/** UI-R1-10 — batch latest scores for leads list column. */
export async function fetchAiScoresBatch(
  token: string,
  entityType: string,
  entityIds: Array<string | number>,
): Promise<Record<string, LeadScoreSummary>> {
  const ids = [...new Set(entityIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 50);
  if (!ids.length) {
    return {};
  }
  const qs = new URLSearchParams({
    entity_type: entityType,
    entity_ids: ids.join(','),
  });
  const res = await fetch(`${API_BASE}/api/v1/ai/scores/batch?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiScoresBatchResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Fetch scores batch failed', res.status);
  }
  const out: Record<string, LeadScoreSummary> = {};
  for (const [entityId, row] of Object.entries(body.data.scores_by_entity_id ?? {})) {
    out[entityId] = {
      score_value: row.score_value,
      score_band: row.explainability_json?.score_band ?? 'warm',
      confidence: row.confidence,
    };
  }
  return out;
}

export interface ScoreDealResponse {
  data: {
    deal_id: number;
    score: number;
    confidence: number;
    score_band: 'hot' | 'warm' | 'cold';
    explainability: AiExplainability;
    cached: boolean;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface NextBestActionResponse {
  data: {
    recommendation_id: string;
    entity_type?: 'lead' | 'deal';
    entity_id?: number;
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
  errors: unknown[];
}

export async function postAiScoreDeal(
  token: string,
  dealId: number,
  force = false,
): Promise<ScoreDealResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/score/deal`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal_id: dealId, force }),
  });
  const body = await parseJson<ScoreDealResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Score deal failed', res.status);
  }
  return body;
}

export async function postAiNextBestAction(
  token: string,
  input: { deal_id?: number; lead_id?: number; entity_type?: 'lead' | 'deal'; force?: boolean },
): Promise<NextBestActionResponse> {
  const entityType = input.entity_type ?? (input.deal_id != null ? 'deal' : 'lead');
  const entityId = input.deal_id ?? input.lead_id;
  const res = await fetch(`${API_BASE}/api/v1/ai/next-best-action`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deal_id: input.deal_id,
      lead_id: input.lead_id,
      entity_type: entityType,
      entity_id: entityId,
      force: input.force ?? false,
    }),
  });
  const body = await parseJson<NextBestActionResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'NBA failed', res.status);
  }
  return body;
}

export interface RouteLeadResponse {
  data: {
    recommendation_id: string;
    lead_id: number;
    recommended_staff_id: number;
    recommended_staff_name: string;
    recommended_staff_code: string;
    strategy: 'project_pool' | 'source_match' | 'global_round_robin';
    reason: string;
    confidence: number;
    status: string;
    recommendation_text: string;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function postAiRouteLead(
  token: string,
  leadId: number,
  force = false,
): Promise<RouteLeadResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/route/lead`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ lead_id: leadId, force }),
  });
  const body = await parseJson<RouteLeadResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Route lead failed', res.status);
  }
  return body;
}

export async function postAiSummarize(
  token: string,
  input: {
    context: SummarizeContext;
    entity_type?: string;
    entity_id?: string | number;
    text?: string;
  },
): Promise<AiSummarizeResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/summarize`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: input.context,
      entity_type: input.entity_type,
      entity_id: input.entity_id != null ? String(input.entity_id) : undefined,
      text: input.text,
    }),
  });
  const body = await parseJson<
    AiSummarizeResponse & { error?: string; message?: string; retry_after_sec?: number }
  >(res);
  if (!res.ok) {
    const msg =
      body.message ??
      body.error ??
      (typeof body === 'object' && body && 'error' in body ? String(body.error) : 'Summarize failed');
    throw new ApiError(msg, res.status);
  }
  return body;
}

export async function postAiRecommendation(
  token: string,
  input: {
    type?: string;
    entity_type?: string;
    entity_id?: string | number;
    channel_hint?: FollowUpChannelHint;
    context_text?: string;
  },
): Promise<AiRecommendationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendation`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: input.type ?? 'follow_up_draft',
      entity_type: input.entity_type ?? 'lead',
      entity_id: input.entity_id != null ? String(input.entity_id) : undefined,
      channel_hint: input.channel_hint,
      context_text: input.context_text,
    }),
  });
  const body = await parseJson<
    AiRecommendationResponse & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Recommendation failed', res.status);
  }
  return body;
}

export async function patchAiRecommendation(
  token: string,
  id: string,
  input: {
    status: 'accepted' | 'dismissed';
    final_text?: string;
    dismiss_reason?: string;
  },
): Promise<AiRecommendationResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<
    AiRecommendationResponse & { error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Patch recommendation failed', res.status);
  }
  return body;
}

export async function fetchAiRecommendations(
  token: string,
  entityType: string,
  entityId: string | number,
  opts?: { status?: RecommendationStatus; limit?: number },
): Promise<AiRecommendationListResponse> {
  const qs = new URLSearchParams({
    entity_type: entityType,
    entity_id: String(entityId),
  });
  if (opts?.status) qs.set('status', opts.status);
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendations?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiRecommendationListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Fetch recommendations failed', res.status);
  }
  return body;
}

/** Poll until score visible or timeout (RNOS-08 UI-R1-06). */
export async function pollAiScoreUntilReady(
  token: string,
  leadId: number,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<AiScoreRecord | null> {
  const intervalMs = opts?.intervalMs ?? 3000;
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const out = await fetchAiScores(token, 'lead', leadId, 1);
      if (out.data.latest) {
        return out.data.latest;
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export interface AiScoreLatencyMetrics {
  window_days: number;
  scored_leads: number;
  within_30s_count: number;
  within_30s_pct: number;
  p95_latency_sec: number;
  gate_pass: boolean;
  gate_target_sec: number;
  agent_runs_p95_ms: number | null;
  narrative: string;
}

export async function fetchAiScoreLatencyMetrics(
  token: string,
  days = 7,
): Promise<{ ok: boolean; data: AiScoreLatencyMetrics }> {
  const qs = days !== 7 ? `?days=${days}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/metrics/score-latency${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ ok: boolean; data: AiScoreLatencyMetrics; error?: string }>(res);
  if (!res.ok) throw new ApiError(body.error ?? 'Score latency metrics failed', res.status);
  return body;
}

export const DISMISS_REASON_PRESETS = [
  { value: 'wrong_tone', label: 'Sai tone' },
  { value: 'wrong_fact', label: 'Sai thông tin' },
  { value: 'not_needed', label: 'Không cần' },
  { value: 'other', label: 'Khác' },
] as const;

export interface AiAcceptanceMetrics {
  acceptance_rate_pct: number | null;
  accepted: number;
  dismissed: number;
  pending: number;
  total_resolved: number;
  by_type: Array<{
    recommendation_type: string;
    accepted: number;
    dismissed: number;
    pending: number;
  }>;
  top_dismiss_reasons: Array<{ reason: string; count: number }>;
  from: string;
  to: string;
}

export interface AiAcceptanceMetricsResponse {
  data: AiAcceptanceMetrics;
  meta: { request_id: string };
  errors: unknown[];
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
  errors: unknown[];
}

export interface LmpSciAnalyticsMetrics {
  window_days: number;
  prep_ready_count: number;
  prep_running_count: number;
  debrief_submitted_count: number;
  chot_with_sci_count: number;
  tier_mix: { CB: number; TC: number; CS: number; unknown: number };
  avg_close_readiness: number | null;
  helpful_rate_pct: number | null;
  top_objections: Array<{ objection: string; count: number }>;
}

export interface LmpSciAnalyticsResponse {
  data: LmpSciAnalyticsMetrics;
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchLmpSciAnalytics(
  token: string,
  params?: { days?: number },
): Promise<LmpSciAnalyticsResponse> {
  const qs = new URLSearchParams();
  if (params?.days != null) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/analytics/sci${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<LmpSciAnalyticsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch SCI analytics failed', res.status);
  }
  return body;
}

export async function fetchAiAcceptanceMetrics(
  token: string,
  params?: { from?: string; to?: string; days?: number; recommendation_type?: string },
): Promise<AiAcceptanceMetricsResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.recommendation_type) qs.set('recommendation_type', params.recommendation_type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/analytics/acceptance${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAcceptanceMetricsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI acceptance metrics failed', res.status);
  }
  return body;
}

export interface AiDismissReasonMetricsResponse {
  data: {
    from: string;
    to: string;
    recommendation_type: string | null;
    dismissed: number;
    top_dismiss_reasons: Array<{ reason: string; count: number }>;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAiDismissReasons(
  token: string,
  params?: { from?: string; to?: string; days?: number; recommendation_type?: string },
): Promise<AiDismissReasonMetricsResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.recommendation_type) qs.set('recommendation_type', params.recommendation_type);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/analytics/dismiss-reasons${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiDismissReasonMetricsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI dismiss reasons failed', res.status);
  }
  return body;
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
  errors: unknown[];
}

export async function fetchAiAdoptionMetrics(
  token: string,
  params?: { from?: string; to?: string; days?: number },
): Promise<AiAdoptionMetricsResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.days != null) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/analytics/adoption${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAdoptionMetricsResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI adoption metrics failed', res.status);
  }
  return body;
}

export async function fetchEntityTimeline(
  token: string,
  entityType: string,
  entityId: string | number,
  params?: { limit?: number; event_source?: string },
): Promise<{
  data: {
    entity_type: string;
    entity_id: string;
    events: Array<{
      id: string;
      event_type: string;
      event_source: string;
      title: string;
      body: string | null;
      occurred_at: string;
    }>;
    total: number;
  };
  errors?: Array<{ code?: string; message?: string }>;
}> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.event_source) qs.set('event_source', params.event_source);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/timeline/${entityType}/${entityId}${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch entity timeline failed', res.status);
  }
  return body as {
    data: {
      entity_type: string;
      entity_id: string;
      events: Array<{
        id: string;
        event_type: string;
        event_source: string;
        title: string;
        body: string | null;
        occurred_at: string;
      }>;
      total: number;
    };
    errors?: Array<{ code?: string; message?: string }>;
  };
}

export async function fetchAiRecommendationsInbox(
  token: string,
  params?: {
    status?: RecommendationStatus;
    from?: string;
    to?: string;
    days?: number;
    limit?: number;
    offset?: number;
  },
): Promise<AiRecommendationInboxResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.days != null) qs.set('days', String(params.days));
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/recommendations/inbox${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiRecommendationInboxResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI inbox failed', res.status);
  }
  return body;
}

export type AiAgentRunStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface AiAgentRunRow {
  id: string;
  client_id: string | null;
  agent_name: string;
  use_case: string | null;
  model_name: string | null;
  prompt_hash: string | null;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  status: AiAgentRunStatus;
  latency_ms: number | null;
  token_usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error_message: string | null;
  correlation_id: string | null;
  actor_id: string | null;
  parent_run_id: string | null;
  orchestration_id: string | null;
  step_key: string | null;
  step_index: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  prompt_visible: boolean;
}

export interface AiAgentRunsListResponse {
  data: {
    rows: AiAgentRunRow[];
    total: number;
    limit: number;
    offset: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface AiAgentRunDetailResponse {
  data: AiAgentRunRow;
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAiAgentRuns(
  token: string,
  params?: {
    from?: string;
    to?: string;
    use_case?: string;
    actor_id?: string;
    entity_type?: string;
    entity_id?: string;
    status?: AiAgentRunStatus;
    limit?: number;
    offset?: number;
  },
): Promise<AiAgentRunsListResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.use_case) qs.set('use_case', params.use_case);
  if (params?.actor_id) qs.set('actor_id', params.actor_id);
  if (params?.entity_type) qs.set('entity_type', params.entity_type);
  if (params?.entity_id) qs.set('entity_id', params.entity_id);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/runs${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAgentRunsListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI agent runs failed', res.status);
  }
  return body;
}

export async function fetchAiAgentRunById(token: string, id: string): Promise<AiAgentRunDetailResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/runs/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiAgentRunDetailResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI agent run failed', res.status);
  }
  return body;
}

export type AiOrchestrationStatus = 'running' | 'succeeded' | 'failed' | 'cancelled';
export type AiOrchestrationTriggerType = 'manual' | 'cron' | 'webhook' | 'workflow';

export interface AiOrchestration {
  id: string;
  client_id: string | null;
  trigger_type: AiOrchestrationTriggerType;
  trigger_ref: string | null;
  plan_key: string;
  status: AiOrchestrationStatus;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  correlation_id: string | null;
  actor_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface OrchestrationListQuery {
  from?: string;
  to?: string;
  plan_key?: string;
  status?: AiOrchestrationStatus;
  limit?: number;
  offset?: number;
}

export interface OrchestrationListResponse {
  data: {
    rows: AiOrchestration[];
    total: number;
    limit: number;
    offset: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface OrchestrationDetail {
  orchestration: AiOrchestration;
  parentRun: AiAgentRunRow | null;
  children: AiAgentRunRow[];
}

export interface OrchestrationDetailResponse {
  data: OrchestrationDetail;
  meta: { request_id: string };
  errors: unknown[];
}

export interface OrchestratorRunBody {
  planKey: string;
  clientId?: string;
  input: {
    entityType: string;
    entityId: string;
    [key: string]: unknown;
  };
}

export interface OrchestratorRunResponse {
  data: {
    orchestration_id: string;
    parent_run_id: string;
    plan_key: string;
    status: 'succeeded';
    steps: Array<{
      stepKey: string;
      stepIndex: number;
      required: boolean;
      status: 'succeeded' | 'failed' | 'skipped';
      runId?: string;
      data?: unknown;
      error?: string;
    }>;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchOrchestrations(
  token: string,
  params?: OrchestrationListQuery,
): Promise<OrchestrationListResponse> {
  const qs = new URLSearchParams();
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.plan_key) qs.set('plan_key', params.plan_key);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/orchestrator${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<OrchestrationListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch orchestrations failed', res.status);
  }
  return body;
}

export async function fetchOrchestrationById(
  token: string,
  id: string,
): Promise<OrchestrationDetailResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/orchestrator/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<OrchestrationDetailResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch orchestration failed', res.status);
  }
  return body;
}

export async function postOrchestratorRun(
  token: string,
  input: OrchestratorRunBody,
): Promise<OrchestratorRunResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/orchestrator/run`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<OrchestratorRunResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Run orchestration failed', res.status);
  }
  return body;
}

export interface AiToolApiKey {
  id: string;
  name: string;
  key_prefix: string;
  client_id: string | null;
  allowed_tools: string[];
  rate_limit_per_min: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface AiToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  mutating: boolean;
  requiredCaps: string[];
}

export interface AiToolKeysResponse {
  keys: AiToolApiKey[];
}

export interface CreateAiToolKeyInput {
  name: string;
  allowed_tools: string[];
  client_id?: string | null;
}

export interface CreateAiToolKeyResponse {
  id: string;
  key: string;
  key_prefix: string;
}

export interface AiToolsCatalogResponse {
  tools: AiToolDescriptor[];
}

export async function fetchAiToolKeys(token: string): Promise<AiToolKeysResponse> {
  const res = await fetch(`${API_BASE}/api/v1/admin/ai/tool-keys`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiToolKeysResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI tool keys failed', res.status);
  }
  return body;
}

export async function createAiToolKey(
  token: string,
  input: CreateAiToolKeyInput,
): Promise<CreateAiToolKeyResponse> {
  const res = await fetch(`${API_BASE}/api/v1/admin/ai/tool-keys`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<CreateAiToolKeyResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Create AI tool key failed', res.status);
  }
  return body;
}

export async function revokeAiToolKey(
  token: string,
  id: string,
): Promise<{ id: string; revoked: true }> {
  const res = await fetch(`${API_BASE}/api/v1/admin/ai/tool-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  const body = await parseJson<
    { id: string; revoked: true; error?: string; message?: string }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Revoke AI tool key failed', res.status);
  }
  return body;
}

export async function fetchAiToolsCatalog(token: string): Promise<AiToolsCatalogResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/tools`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AiToolsCatalogResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch AI tools catalog failed', res.status);
  }
  return body;
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

export interface PipelineRiskListResponse {
  data: {
    deals: PipelineRiskDealRow[];
    total: number;
    last_scan_at: string | null;
  };
  meta: { request_id: string };
  errors: [];
}

export interface PipelineRiskScanResponse {
  data: {
    scanned: number;
    at_risk_found: number;
    alerts_created: number;
    alerts_skipped: number;
    alerts_cleared: number;
    agent_run_id: string;
    scanned_at: string;
  };
  meta: { request_id: string };
  errors: [];
}

export async function fetchPipelineRiskAtRisk(
  token: string,
  params?: { limit?: number; offset?: number },
): Promise<PipelineRiskListResponse> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/pipeline-risk/at-risk${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<PipelineRiskListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch pipeline risk failed', res.status);
  }
  return body;
}

export async function postPipelineRiskScan(
  token: string,
  input?: { limit?: number },
): Promise<PipelineRiskScanResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/pipeline-risk/scan`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  const body = await parseJson<PipelineRiskScanResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Pipeline risk scan failed', res.status);
  }
  return body;
}

export async function patchPipelineRiskAssign(
  token: string,
  recommendationId: string,
  input: { staff_id: number; staff_name: string },
): Promise<{
  data: {
    recommendation_id: string;
    deal_id: number;
    follow_up_owner_id: number;
    follow_up_owner_name: string;
    assigned_at: string;
    assigned_by: string;
  };
  meta: { request_id: string };
}> {
  const res = await fetch(`${API_BASE}/api/v1/ai/pipeline-risk/${recommendationId}/assign`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Assign pipeline owner failed', res.status);
  }
  return body as {
    data: {
      recommendation_id: string;
      deal_id: number;
      follow_up_owner_id: number;
      follow_up_owner_name: string;
      assigned_at: string;
      assigned_by: string;
    };
    meta: { request_id: string };
  };
}

export async function postPipelineRiskActivity(
  token: string,
  recommendationId: string,
  input: { note: string },
): Promise<{
  data: {
    recommendation_id: string;
    deal_id: number;
    event_id: number;
    risk_cleared: boolean;
    logged_at: string;
  };
  meta: { request_id: string };
}> {
  const res = await fetch(`${API_BASE}/api/v1/ai/pipeline-risk/${recommendationId}/activity`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Log pipeline activity failed', res.status);
  }
  return body as {
    data: {
      recommendation_id: string;
      deal_id: number;
      event_id: number;
      risk_cleared: boolean;
      logged_at: string;
    };
    meta: { request_id: string };
  };
}

export interface ForecastStageBucket {
  stage: string;
  label: string;
  deal_count: number;
  raw_vnd: number;
  weighted_vnd: number;
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
  snapshot: {
    id: string;
    snapshot_date: string;
    committed_by: string | null;
    committed_at: string | null;
  } | null;
  pipeline_amount: number;
  forecast_amount: number;
  ai_adjustment: number;
  committed_amount: number;
  best_case_amount: number;
  actual_prior_month_vnd: number;
  stalled_deal_count: number;
  factors: AiScoreFactor[];
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

export interface ForecastSnapshotResponse {
  data: {
    snapshot_id: string;
    snapshot_date: string;
    pipeline_amount: number;
    forecast_amount: number;
    ai_adjustment: number;
    skipped: boolean;
    agent_run_id: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface ForecastCommitResponse {
  data: {
    snapshot_id: string;
    committed_amount: number;
    committed_by: string;
    committed_at: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchForecastDashboard(
  token: string,
  params?: { year?: number; month?: number },
): Promise<ForecastDashboardResponse> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/forecast/current${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<ForecastDashboardResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch forecast dashboard failed', res.status);
  }
  return body;
}

export async function postForecastSnapshot(
  token: string,
  input?: { force?: boolean; snapshot_date?: string },
): Promise<ForecastSnapshotResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/forecast`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  const body = await parseJson<ForecastSnapshotResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Forecast snapshot failed', res.status);
  }
  return body;
}

export async function patchForecastCommit(
  token: string,
  input: {
    snapshot_id: string;
    committed_amount_vnd: number;
    acknowledge_mape_warning?: boolean;
  },
): Promise<ForecastCommitResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/forecast/commit`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      snapshot_id: input.snapshot_id,
      committed_amount_vnd: input.committed_amount_vnd,
      acknowledge_mape_warning: Boolean(input.acknowledge_mape_warning),
    }),
  });
  const body = await parseJson<
    ForecastCommitResponse & { error?: string; message?: string; mape_prior_month?: ForecastMapePriorMonth }
  >(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Forecast commit failed', res.status);
  }
  return body;
}

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

export async function fetchForecastVariance(token: string): Promise<ForecastVarianceResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/forecast/variance`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<ForecastVarianceResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch forecast variance failed', res.status);
  }
  return body;
}

export async function fetchForecastMapeReport(
  token: string,
  params?: { months?: number },
): Promise<ForecastMapeReportResponse> {
  const qs = new URLSearchParams();
  if (params?.months != null) qs.set('months', String(params.months));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/forecast/mape-report${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<ForecastMapeReportResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch MAPE report failed', res.status);
  }
  return body;
}

export interface RenewalPortfolioSummary {
  t90_count: number;
  t60_count: number;
  t30_count: number;
  drill_href: string;
}

export async function fetchRenewalPortfolioSummary(
  token: string,
): Promise<{ data: RenewalPortfolioSummary; meta: { request_id: string } }> {
  const res = await fetch(`${API_BASE}/api/v1/ai/renewal/portfolio-summary`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ data: RenewalPortfolioSummary; meta: { request_id: string }; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch renewal portfolio failed', res.status);
  }
  return body;
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

export async function postChurnRecoveryPlan(
  token: string,
  input: { client_id: string; note: string },
): Promise<{ data: { id: string; client_id: string; note: string; created_at: string }; meta: { request_id: string } }> {
  const res = await fetch(`${API_BASE}/api/v1/ai/health/recovery-plan`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Log recovery plan failed', res.status);
  }
  return body as {
    data: { id: string; client_id: string; note: string; created_at: string };
    meta: { request_id: string };
  };
}

export async function fetchChurnRecoveryPlans(
  token: string,
  params?: { client_id?: string; limit?: number },
): Promise<{ data: { client_id: string; entries: ChurnRecoveryPlanEntry[]; total: number }; meta: { request_id: string } }> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/health/recovery-plans${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ error?: string; message?: string } & Record<string, unknown>>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch recovery plans failed', res.status);
  }
  return body as {
    data: { client_id: string; entries: ChurnRecoveryPlanEntry[]; total: number };
    meta: { request_id: string };
  };
}

export interface RenewalHealthSnapshot {
  health_score: number;
  health_band: 'healthy' | 'watch' | 'at_risk' | 'critical';
  churn_risk_pct: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  factors: AiScoreFactor[];
}

export interface RenewalOpportunityView {
  id: string;
  client_id: string;
  contract_id: number;
  contract_title: string;
  amount_vnd: number;
  renewal_date: string;
  days_until_end: number;
  trigger_window: 90 | 60 | 30;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'renewed' | 'lost' | 'deferred';
  health: RenewalHealthSnapshot;
  draft_text: string | null;
  draft_channel: 'email' | 'zalo' | null;
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

export async function fetchRenewalOpportunities(token: string, clientId: string): Promise<RenewalListResponse> {
  const qs = new URLSearchParams({ client_id: clientId });
  const res = await fetch(`${API_BASE}/api/v1/ai/renewal?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<RenewalListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch renewal failed', res.status);
  }
  return body;
}

export async function postRenewalDraft(
  token: string,
  opportunityId: string,
  channel: 'email' | 'zalo',
): Promise<{ data: { draft_text: string; recommendation_id: string }; meta: { request_id: string }; errors: unknown[] }> {
  const res = await fetch(`${API_BASE}/api/v1/ai/renewal/${encodeURIComponent(opportunityId)}/draft`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
  const body = await parseJson<{ data: { draft_text: string; recommendation_id: string }; meta: { request_id: string }; errors: unknown[]; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Renewal draft failed', res.status);
  }
  return body;
}

export async function patchRenewalApprove(token: string, opportunityId: string, finalText: string) {
  const res = await fetch(`${API_BASE}/api/v1/ai/renewal/${encodeURIComponent(opportunityId)}/approve`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ final_text: finalText }),
  });
  const body = await parseJson<{ error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Renewal approve failed', res.status);
  }
  return body;
}

export async function patchRenewalOutcome(token: string, opportunityId: string, outcome: 'renewed' | 'lost') {
  const res = await fetch(`${API_BASE}/api/v1/ai/renewal/${encodeURIComponent(opportunityId)}/outcome`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ outcome }),
  });
  const body = await parseJson<{ error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Renewal outcome failed', res.status);
  }
  return body;
}

export async function postRenewalScan(token: string, windows?: number[]) {
  const res = await fetch(`${API_BASE}/api/v1/ai/renewal/scan`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(windows?.length ? { windows } : {}),
  });
  const body = await parseJson<{ error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Renewal scan failed', res.status);
  }
  return body;
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

export interface UpsellListResponse {
  data: {
    client_id: string;
    suggestions: UpsellSuggestionView[];
    total: number;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchUpsellSuggestions(token: string, clientId: string): Promise<UpsellListResponse> {
  const qs = new URLSearchParams({ client_id: clientId });
  const res = await fetch(`${API_BASE}/api/v1/ai/upsell?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<UpsellListResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch upsell failed', res.status);
  }
  return body;
}

export async function postUpsellSuggest(
  token: string,
  clientId: string,
  opts?: { force?: boolean; limit?: number },
) {
  const res = await fetch(`${API_BASE}/api/v1/ai/upsell/suggest`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      force: Boolean(opts?.force),
      limit: opts?.limit ?? 3,
    }),
  });
  const body = await parseJson<{ error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Upsell suggest failed', res.status);
  }
  return body;
}

export async function patchUpsellApprove(token: string, recommendationId: string, finalText: string) {
  const res = await fetch(`${API_BASE}/api/v1/ai/upsell/${encodeURIComponent(recommendationId)}/approve`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ final_text: finalText }),
  });
  const body = await parseJson<{ error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Upsell approve failed', res.status);
  }
  return body;
}

export async function patchUpsellDismiss(token: string, recommendationId: string, reason?: string) {
  const res = await fetch(`${API_BASE}/api/v1/ai/upsell/${encodeURIComponent(recommendationId)}/dismiss`, {
    method: 'PATCH',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const body = await parseJson<{ error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Upsell dismiss failed', res.status);
  }
  return body;
}

export interface ChurnHealthSnapshot {
  health_score: number;
  health_band: 'healthy' | 'watch' | 'at_risk' | 'critical';
  churn_risk_pct: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  ticket_spike: boolean;
  renewal_recommended: boolean;
  factors: AiScoreFactor[];
  signals: {
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
  };
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

export interface ChurnHealthDashboardResponse {
  data: {
    clients: ChurnHealthClientView[];
    total: number;
    filters: { sort: string; order: string; ticket_spike: boolean };
  };
  meta: { request_id: string };
  errors: unknown[];
}

export interface ChurnHealthClientResponse {
  data: ChurnHealthClientView | null;
  meta: { request_id: string };
  errors: unknown[];
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

export async function fetchChurnHealthDashboard(
  token: string,
  params?: { sort?: string; order?: string; ticket_spike?: boolean; limit?: number; offset?: number },
): Promise<ChurnHealthDashboardResponse> {
  const qs = new URLSearchParams();
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.order) qs.set('order', params.order);
  if (params?.ticket_spike) qs.set('ticket_spike', '1');
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/health${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<ChurnHealthDashboardResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch churn health dashboard failed', res.status);
  }
  return body;
}

export async function fetchClientChurnHealth(token: string, clientId: string): Promise<ChurnHealthClientResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/health/client/${encodeURIComponent(clientId)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<ChurnHealthClientResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch client health failed', res.status);
  }
  return body;
}

export async function postChurnScore(
  token: string,
  input?: { client_id?: string; force?: boolean; limit?: number },
): Promise<ChurnScoreResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/score/churn`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  const body = await parseJson<ChurnScoreResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Churn score failed', res.status);
  }
  return body;
}

export interface CoachDigestCard {
  key: 'sla' | 'ai_acceptance' | 'pipeline_risk' | 'channel_anomaly';
  title: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
  metrics: Record<string, number | string | null>;
  drill_href: string;
}

export interface CoachDigestSnapshot {
  week_key: string;
  week_label: string;
  week_start: string;
  week_end: string;
  team_id: string;
  narrative: string;
  severity: 'info' | 'warning' | 'critical';
  cards: CoachDigestCard[];
  email_preview: string;
}

export interface CoachDigestRecord {
  id: string;
  team_id: string;
  week_key: string;
  snapshot: CoachDigestSnapshot;
  agent_run_id: string | null;
  created_at: string;
}

export interface CoachDigestCurrentResponse {
  data: CoachDigestRecord | null;
  meta: { request_id: string };
  errors: unknown[];
}

export interface CoachDigestGenerateResponse {
  data: {
    created: boolean;
    skipped: boolean;
    digest: CoachDigestRecord | null;
    agent_run_id: string;
    generated_at: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchCoachDigestCurrent(
  token: string,
  teamId?: string,
): Promise<CoachDigestCurrentResponse> {
  const qs = teamId ? `?team_id=${encodeURIComponent(teamId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/coach/current${qs}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CoachDigestCurrentResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch coach digest failed', res.status);
  }
  return body;
}

export async function postCoachDigestGenerate(
  token: string,
  input?: { team_id?: string; force?: boolean },
): Promise<CoachDigestGenerateResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/coach/generate`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  });
  const body = await parseJson<CoachDigestGenerateResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Coach digest generate failed', res.status);
  }
  return body;
}

export interface NlQueryCatalogEntry {
  id: string;
  label: string;
  aliases: string[];
  category: string;
  result_kind: 'table' | 'chart';
  description: string;
}

export interface NlQueryColumn {
  key: string;
  label: string;
  type?: 'number' | 'string' | 'currency' | 'pct';
}

export interface NlQueryChart {
  type: 'bar' | 'line';
  labels: string[];
  series: Array<{ key: string; label: string; values: number[] }>;
}

export interface NlQueryResultPayload {
  intent_id: string;
  label: string;
  narrative: string;
  result_kind: 'table' | 'chart';
  columns: NlQueryColumn[];
  rows: Array<Record<string, unknown>>;
  chart?: NlQueryChart;
  read_only: true;
  drill_href?: string;
}

export interface NlQueryCatalogResponse {
  data: { intents: NlQueryCatalogEntry[]; total: number };
  meta: { request_id: string };
  errors: unknown[];
}

export interface NlQueryRunResponse {
  data: NlQueryResultPayload;
  meta: { request_id: string; agent_run_id?: string };
  errors: unknown[];
}

export async function fetchNlQueryCatalog(token: string): Promise<NlQueryCatalogResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/query/catalog`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<NlQueryCatalogResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch NL query catalog failed', res.status);
  }
  return body;
}

export async function postNlQuery(
  token: string,
  input: { intent_id?: string; question?: string },
): Promise<NlQueryRunResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/query`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<NlQueryRunResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'NL query failed', res.status);
  }
  return body;
}

export interface TicketSentimentFactor {
  key: string;
  label: string;
  delta: number;
  sign: '+' | '-';
}

export interface TicketSentimentScoreResponse {
  data: {
    ticket_id: number;
    label: 'positive' | 'neutral' | 'negative';
    score: number;
    confidence: number;
    factors: TicketSentimentFactor[];
    flags: string[];
    model_name: string;
    model_version: string;
    scored_at: string;
    cached?: boolean;
  };
}

export async function postTicketSentiment(
  token: string,
  body: { ticket_id: number; force?: boolean },
): Promise<TicketSentimentScoreResponse> {
  const res = await fetch(`${API_BASE}/api/v1/ai/sentiment/ticket`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await parseJson<TicketSentimentScoreResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(json.message ?? json.error ?? 'Ticket sentiment failed', res.status);
  }
  return json;
}

export interface AnomalyDigestItem {
  alert_type: string;
  channel: 'meta' | 'zalo';
  campaign_id: string | null;
  message: string;
  severity: string;
  metric_value: number | null;
}

export interface AnomalyDigestSnapshot {
  narrative: string;
  bullets: string[];
  severity: 'info' | 'warning' | 'critical';
  anomalies: AnomalyDigestItem[];
  drill_href: string;
  read_only: true;
}

export interface AnomalyDigestResponse {
  data: {
    enabled: boolean;
    client_id: string | null;
    channel: 'meta' | 'zalo' | 'all';
    days: number;
    digest: AnomalyDigestSnapshot | null;
    summary: {
      meta_open_alerts: number;
      zalo_open_alerts: number;
      cpl_spike_count: number;
      zero_leads_24h_count: number;
      roas_low_count: number;
      spend_spike_count: number;
    };
    agent_run_id?: string | null;
    generated_at: string;
    error?: string;
  };
  meta: { request_id: string };
  errors: unknown[];
}

export async function fetchAnomalyDigest(
  token: string,
  params?: { client_id?: string; channel?: 'meta' | 'zalo' | 'all'; days?: number },
): Promise<AnomalyDigestResponse> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.days) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/anomaly/digest${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<AnomalyDigestResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Anomaly digest failed', res.status);
  }
  return body;
}

export interface CplDigestClientRow {
  client_id: string | null;
  channel: string;
  narrative: string;
  anomalies: Array<{
    alert_type: string;
    channel: string;
    campaign_id: string | null;
    message: string;
    severity: string;
    metric_value: number | null;
  }>;
  severity: string;
}

export interface CplDigestResponse {
  ok: boolean;
  period: { days: number; from: string; to: string };
  narrative: string;
  clients: CplDigestClientRow[];
  summary: {
    cpl_spike_count: number;
    meta_open_alerts: number;
    zalo_open_alerts: number;
  };
  read_only: true;
  generated_at: string;
  request_id: string;
}

export async function fetchCplDigest(
  token: string,
  params?: { client_id?: string; channel?: string; days?: number },
): Promise<CplDigestResponse> {
  const qs = new URLSearchParams();
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.channel) qs.set('channel', params.channel);
  if (params?.days) qs.set('days', String(params.days));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/cpl-digest${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<CplDigestResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'CPL digest failed', res.status);
  }
  return body;
}
