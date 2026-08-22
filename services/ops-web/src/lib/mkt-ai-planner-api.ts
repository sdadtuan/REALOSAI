import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function mktAiFetch<T>(
  token: string,
  lifecycleId: number,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/ai-planner${path}`,
    { ...init, headers },
  );
  const body = await parseJson<
    T & {
      error?: string;
      message?: string;
      missing?: string[];
      messages?: string[];
    }
  >(res);
  if (!res.ok) {
    const detail =
      body.messages?.join(' · ') ??
      body.message ??
      body.error ??
      'AI Planner request failed';
    throw new ApiError(detail, res.status);
  }
  return body;
}

export interface MktAiBrief {
  brand_name?: string;
  industry?: string;
  service_slug?: string;
  objective?: string;
  budget_monthly_vnd?: number;
  geo_markets?: string[];
  competitors?: string[];
  challenges?: string;
  usp?: string;
  website_url?: string;
  timeline_start?: string;
  timeline_end?: string;
  notes?: string;
  use_rag?: boolean;
}

export interface MktAiBriefValidation {
  ok: boolean;
  missing: string[];
  messages: string[];
}

export interface MktAiBriefReadiness {
  score: number;
  criteria: Record<string, boolean>;
  messages: string[];
  missing: string[];
  low_threshold: number;
}

export interface MktAiBriefUploadResult {
  brief: MktAiBrief;
  brief_validation: MktAiBriefValidation;
  brief_readiness: MktAiBriefReadiness;
  extracted_fields: Partial<MktAiBrief>;
  missing: string[];
  filename: string;
}

export interface MktAiKpiTreeNode {
  id: string;
  label: string;
  target?: string;
  unit?: string;
  children?: MktAiKpiTreeNode[];
}

export interface MktAiCitation {
  chunk_id: number;
  document_id: number;
  filename: string;
  page_no: number | null;
  section_key?: string;
  excerpt?: string;
}

export interface MktAiDocumentRow {
  id: number;
  lifecycle_id: number;
  filename: string;
  mime_type: string;
  file_size_bytes: number | null;
  status: 'pending' | 'indexing' | 'indexed' | 'failed' | 'archived';
  chunk_count: number;
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  metadata_json?: Record<string, unknown>;
}

export interface MktAiCampaignDraft {
  name: string;
  objective: string;
  channel_mix: string[];
  budget_pct: number;
  timeline_weeks?: string;
  milestones?: string[];
  kpis?: string[];
}

export interface MktAiDraft {
  strategy_framework: Record<string, string>;
  target_market_prof: Record<string, string>;
  swot_json: Record<string, unknown>;
  campaigns_json: MktAiCampaignDraft[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
  kpi_tree_json?: MktAiKpiTreeNode[];
  kpi_tree_applied_json?: MktAiKpiTreeNode[];
  competitor_snapshot_json?: MktAiCompetitorSnapshot;
}

export interface MktAiCompetitorSnapshotEntry {
  name: string;
  positioning?: string;
  strengths?: string[];
  weaknesses?: string[];
  channels?: string[];
  threat_level?: 'low' | 'medium' | 'high';
}

export interface MktAiCompetitorSnapshot {
  generated_at: string;
  source: 'brief' | 'ai' | 'stub';
  competitors: MktAiCompetitorSnapshotEntry[];
  summary_vi?: string;
}

export interface MktAiJobRow {
  id: number;
  lifecycle_id: number;
  job_type: string;
  status: string;
  model_name: string;
  error_message: string | null;
  latency_ms: number | null;
  actor_email: string;
  created_at: string;
  ended_at: string | null;
  /** WS-P4-07 — optional when PG column present */
  parent_job_id?: number | null;
  /** WS-P4-07 — child_jobs refs on multi_agent parent */
  output_json?: Record<string, unknown>;
}

export interface MktAiPlannerContext {
  lifecycle_id: number;
  stage: string;
  service_slug: string;
  enabled: boolean;
  brief: MktAiBrief | null;
  brief_validation: MktAiBriefValidation;
  brief_readiness?: MktAiBriefReadiness;
  prefill_sources: string[];
  jobs: MktAiJobRow[];
  draft: MktAiDraft;
  tmmt_validation: { ok: boolean; messages: string[]; filled_count?: number };
  quality_score?: {
    score: number;
    criteria: Record<string, boolean>;
    can_apply: boolean;
    can_export: boolean;
    can_export_docx_only?: boolean;
  };
  flags: {
    rag_enabled: boolean;
    approval_required: boolean;
    stub_mode: boolean;
    playbooks_enabled?: boolean;
    playbook_governance_enabled?: boolean;
    launch_qa_quality_gate_enabled?: boolean;
    multi_agent_enabled?: boolean;
    plan_depth_enabled?: boolean;
    brief_upload_enabled?: boolean;
    scenario_compare_enabled?: boolean;
    section_comments_enabled?: boolean;
    export_pptx_enabled?: boolean;
    kpi_closed_loop_enabled?: boolean;
  };
  strategy_scenarios?: MktAiStrategyScenarioRow[];
  section_comments?: MktAiSectionCommentRow[];
  documents?: MktAiDocumentRow[];
  rag?: { use_rag: boolean; indexed_count: number };
  budget_scenarios?: MktAiBudgetScenarioRow[];
  approval?: MktAiApprovalContext;
  comments?: MktAiCommentRow[];
  plan_versions?: MktAiPlanVersionSummary[];
  playbook?: {
    slug: string | null;
    label_vi: string | null;
    quality_gate: { min_score_launch_qa: number; met: boolean };
    governance_notes: string[];
  };
  launch_qa_quality_gate?: {
    required: boolean;
    min_score: number;
    current_score: number | null;
    ok: boolean;
    message_vi: string;
  };
  governance?: {
    enabled: boolean;
    playbook_label: string | null;
    notes: string[];
    launch_qa_gate: {
      required: boolean;
      min_score: number;
      current_score: number | null;
      ok: boolean;
      message_vi: string;
    };
  };
  multi_agent?: MktAiMultiAgentStatusPayload;
}

export type MktAiApprovalStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'cancelled';

export interface MktAiPlanVersionSummary {
  id: number;
  version_no: number;
  label: string;
  status: string;
  created_by: string;
  created_at: string;
  quality_score: number | null;
  campaign_count: number;
}

export interface MktAiPlanVersionRow {
  id: number;
  lifecycle_id: number;
  version_no: number;
  label: string;
  status: string;
  brief_json: MktAiBrief;
  strategy_framework_json: Record<string, string>;
  target_market_prof_json: Record<string, string>;
  campaigns_json: MktAiCampaignDraft[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
  created_by: string;
  created_at: string;
}

export interface MktAiApprovalRow {
  id: number;
  lifecycle_id: number;
  plan_version_id: number;
  status: MktAiApprovalStatus;
  requested_by: string;
  approver_email: string | null;
  decision_note: string;
  requested_at: string;
  decided_at: string | null;
  plan_version?: MktAiPlanVersionRow;
}

export interface MktAiCommentRow {
  id: number;
  lifecycle_id: number;
  plan_version_id: number | null;
  approval_id: number | null;
  author_email: string;
  body: string;
  created_at: string;
}

export interface MktAiApprovalContext {
  required: boolean;
  latest: MktAiApprovalRow | null;
  can_export: boolean;
  can_submit: boolean;
}

export interface MktAiBudgetScenarioRow {
  id: number;
  lifecycle_id: number;
  job_id: number | null;
  name: string;
  slug: string;
  budget_monthly_vnd: number;
  channel_mix_json: {
    meta_pct?: number;
    google_pct?: number;
    content_pct?: number;
    reserve_pct?: number;
  };
  cpl_estimates_json: Record<string, number>;
  assumptions_json: Record<string, unknown>;
  rationale_vi?: string | null;
  is_selected: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function fetchMktAiPlannerContext(
  token: string,
  lifecycleId: number,
): Promise<MktAiPlannerContext> {
  return mktAiFetch<MktAiPlannerContext>(token, lifecycleId, '/context');
}

export async function fetchMktAiDocuments(token: string, lifecycleId: number) {
  return mktAiFetch<{ documents: MktAiDocumentRow[]; rag_enabled: boolean }>(
    token,
    lifecycleId,
    '/documents',
  );
}

export async function uploadMktAiDocument(token: string, lifecycleId: number, file: File, tag?: string) {
  const form = new FormData();
  form.append('file', file);
  if (tag?.trim()) form.append('tag', tag.trim());
  const res = await fetch(
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/ai-planner/documents`,
    {
      method: 'POST',
      headers: authHeaders(token) as Record<string, string>,
      body: form,
    },
  );
  const body = await parseJson<{
    document: MktAiDocumentRow;
    error?: string;
    message?: string;
  }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Upload failed', res.status);
  }
  return body;
}

export async function uploadMktAiBrief(token: string, lifecycleId: number, file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/ai-planner/brief/upload`,
    {
      method: 'POST',
      headers: authHeaders(token) as Record<string, string>,
      body: form,
    },
  );
  const body = await parseJson<MktAiBriefUploadResult & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Brief upload failed', res.status);
  }
  return body;
}

export async function patchMktAiBrief(
  token: string,
  lifecycleId: number,
  body: Partial<MktAiBrief>,
): Promise<{
  brief: MktAiBrief;
  brief_validation: MktAiBriefValidation;
  brief_readiness?: MktAiBriefReadiness;
}> {
  return mktAiFetch(token, lifecycleId, '/brief', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function prefillMktAiBriefFromL1Consult(
  token: string,
  lifecycleId: number,
  opts?: { overwrite?: boolean },
): Promise<{
  brief: MktAiBrief;
  brief_validation: MktAiBriefValidation;
  brief_readiness?: MktAiBriefReadiness;
  prefill_sources: string[];
  prefill_target_score: number;
  prefill_meets_target: boolean;
}> {
  return mktAiFetch(token, lifecycleId, '/brief/prefill-l1-consult', {
    method: 'POST',
    body: JSON.stringify({ overwrite: Boolean(opts?.overwrite) }),
  });
}

export async function patchMktAiDraft(
  token: string,
  lifecycleId: number,
  body: Partial<MktAiDraft>,
): Promise<MktAiDraft> {
  return mktAiFetch(token, lifecycleId, '/draft', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function postMktAiStrategyJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/strategy', {
    method: 'POST',
  });
}

export async function postMktAiCampaignsJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/campaigns', {
    method: 'POST',
  });
}

export async function postMktAiContentJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/content', {
    method: 'POST',
  });
}

export async function postMktAiQualityJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string }>(token, lifecycleId, '/jobs/quality', {
    method: 'POST',
  });
}

export async function postMktAiBudgetSimulateJob(
  token: string,
  lifecycleId: number,
  count = 3,
) {
  return mktAiFetch<{
    job_id: number;
    status: string;
    output?: { scenarios?: MktAiBudgetScenarioRow[]; count?: number };
  }>(token, lifecycleId, '/jobs/budget-simulate', {
    method: 'POST',
    body: JSON.stringify({ count }),
  });
}

export async function applyMktAiBudgetScenario(
  token: string,
  lifecycleId: number,
  scenarioId: number,
) {
  return mktAiFetch<{
    scenario: MktAiBudgetScenarioRow;
    campaigns: MktAiCampaignDraft[];
  }>(token, lifecycleId, `/budget-scenarios/${scenarioId}/apply`, {
    method: 'POST',
  });
}

export async function postMktAiJobRetry(
  token: string,
  lifecycleId: number,
  type: 'strategy' | 'campaigns' | 'content' | 'quality',
) {
  return mktAiFetch<{ job_id: number; status: string }>(
    token,
    lifecycleId,
    `/jobs/${type}/retry`,
    { method: 'POST' },
  );
}

export async function postMktAiApply(
  token: string,
  lifecycleId: number,
  body: {
    confirm_overwrite: boolean;
    strategy_framework?: Record<string, string>;
    target_market_prof?: Record<string, string>;
  },
) {
  return mktAiFetch<{
    plan: Record<string, unknown>;
    tmmt_validation: { ok: boolean; messages: string[] };
    filled_count?: number;
  }>(token, lifecycleId, '/apply', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postMktAiExport(
  token: string,
  lifecycleId: number,
  format: 'pdf' | 'docx' | 'xlsx',
) {
  return mktAiFetch<{
    format: string;
    filename: string;
    content: string;
    mime_type: string;
    encoding?: 'base64' | 'utf8';
  }>(token, lifecycleId, '/export', {
    method: 'POST',
    body: JSON.stringify({ format }),
  });
}

export function downloadMktAiExportFile(out: {
  content: string;
  mime_type: string;
  filename: string;
  encoding?: 'base64' | 'utf8';
}) {
  const bytes =
    out.encoding === 'base64'
      ? Uint8Array.from(atob(out.content), (c) => c.charCodeAt(0))
      : new TextEncoder().encode(out.content);
  const blob = new Blob([bytes], { type: out.mime_type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = out.filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchMktAiApprovals(token: string, lifecycleId: number) {
  return mktAiFetch<{ approvals: MktAiApprovalRow[] }>(token, lifecycleId, '/approvals');
}

export async function postMktAiSubmitApproval(
  token: string,
  lifecycleId: number,
  body?: { label?: string; note?: string },
) {
  return mktAiFetch<{ approval: MktAiApprovalRow; plan_version_id: number }>(
    token,
    lifecycleId,
    '/approvals',
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  );
}

export async function postMktAiDecideApproval(
  token: string,
  lifecycleId: number,
  approvalId: number,
  body: { decision: 'approve' | 'changes_requested' | 'reject'; note?: string },
) {
  return mktAiFetch<{ approval: MktAiApprovalRow }>(
    token,
    lifecycleId,
    `/approvals/${approvalId}/decide`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export async function postMktAiComment(
  token: string,
  lifecycleId: number,
  body: { body: string; approval_id?: number; plan_version_id?: number },
) {
  return mktAiFetch<{ comment: MktAiCommentRow }>(token, lifecycleId, '/comments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchMktAiPlanVersions(token: string, lifecycleId: number) {
  return mktAiFetch<{ versions: MktAiPlanVersionRow[] }>(token, lifecycleId, '/versions');
}

export async function fetchMktAiPlanVersion(
  token: string,
  lifecycleId: number,
  versionId: number,
) {
  return mktAiFetch<{ version: MktAiPlanVersionRow }>(
    token,
    lifecycleId,
    `/versions/${versionId}`,
  );
}

export async function postMktAiRestorePlanVersion(
  token: string,
  lifecycleId: number,
  versionId: number,
) {
  return mktAiFetch<{ draft: MktAiDraft; version: MktAiPlanVersionRow }>(
    token,
    lifecycleId,
    `/versions/${versionId}/restore`,
    { method: 'POST', body: '{}' },
  );
}

export interface MktAiDashboardPayload {
  ok: boolean;
  lifecycle_id: number;
  stage: string;
  agency_client_id: string | null;
  linked: boolean;
  period: { from: string; to: string; weeks: number; month_start: string };
  tiles: {
    spend_mtd_vnd: number;
    leads_mtd: number;
    cpl_mtd: number | null;
    roas_mtd: number | null;
    roas_stub: boolean;
  };
  targets: {
    cpl_vnd: number | null;
    roas: number | null;
    source: 'daily_performance' | 'none';
  };
  trend: Array<{
    week_label: string;
    week_start: string;
    spend_vnd: number;
    leads: number;
    cpl: number | null;
    roas: number | null;
    roas_stub: boolean;
  }>;
  deltas: {
    cpl_vs_target_pct: number | null;
    spend_vs_prev_week_pct: number | null;
  };
  flags: { perf_tables_ready: boolean };
  messages: string[];
}

export async function fetchMktAiDashboard(
  token: string,
  lifecycleId: number,
  params?: { weeks?: number; channel?: string },
) {
  const qs = new URLSearchParams();
  if (params?.weeks != null) qs.set('weeks', String(params.weeks));
  if (params?.channel) qs.set('channel', params.channel);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return mktAiFetch<MktAiDashboardPayload>(token, lifecycleId, `/dashboard${suffix}`);
}

export interface MktAiKpiClosedLoopRow {
  id: string;
  label: string;
  metric_kind: 'cpl' | 'leads' | 'roas' | 'spend' | 'other';
  target_display: string;
  target_value: number | null;
  actual_value: number | null;
  actual_display: string;
  delta_pct: number | null;
  unit: string;
  direction: 'lower_better' | 'higher_better';
  alert: boolean;
}

export interface MktAiKpiClosedLoopPayload {
  ok: boolean;
  enabled: boolean;
  lifecycle_id: number;
  has_applied_kpi_tree: boolean;
  linked: boolean;
  threshold_pct: number;
  period: { from: string; to: string; weeks: number; month_start: string };
  rows: MktAiKpiClosedLoopRow[];
  alerts: MktAiKpiClosedLoopRow[];
  messages: string[];
}

export async function fetchMktAiKpiClosedLoop(
  token: string,
  lifecycleId: number,
  params?: { weeks?: number; channel?: string },
) {
  const qs = new URLSearchParams();
  if (params?.weeks != null) qs.set('weeks', String(params.weeks));
  if (params?.channel) qs.set('channel', params.channel);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return mktAiFetch<MktAiKpiClosedLoopPayload>(token, lifecycleId, `/kpi-closed-loop${suffix}`);
}

export interface MktAiWeeklyMemoResult {
  ok: boolean;
  job_id: number;
  status: string;
  memo: {
    title: string;
    body_vi: string;
    week_label: string;
    auto_apply: false;
    sections: Array<{ heading: string; bullets: string[] }>;
  };
  notification_sent?: boolean;
}

export async function postMktAiWeeklyMemoJob(
  token: string,
  lifecycleId: number,
  body?: { notify?: boolean; dry_run?: boolean },
) {
  return mktAiFetch<MktAiWeeklyMemoResult>(token, lifecycleId, '/jobs/optimize/weekly-memo', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function postMktAiCompetitorSnapshotJob(token: string, lifecycleId: number) {
  return mktAiFetch<{ job_id: number; status: string; output?: { competitor_snapshot: MktAiCompetitorSnapshot } }>(
    token,
    lifecycleId,
    '/jobs/strategy/competitor-snapshot',
    { method: 'POST', body: '{}' },
  );
}

export interface MktAiOptimizeRecommendation {
  id: string;
  title: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  suggested_task: { stage: string; title: string; description: string };
}

export interface MktAiOptimizeResult {
  ok: boolean;
  job_id: number;
  status: 'succeeded' | 'failed';
  kpi_context: {
    cpl_delta_pct: number | null;
    spend_vs_prev_week_pct: number | null;
    spend_mtd_vnd: number;
    leads_mtd: number;
    cpl_mtd: number | null;
    roas_mtd: number | null;
    roas_stub: boolean;
    linked: boolean;
    target_cpl_vnd: number | null;
  };
  recommendations: MktAiOptimizeRecommendation[];
  tasks_created?: Array<{ task_id: number; title: string; recommendation_id: string }>;
}

export async function postMktAiOptimizeJob(
  token: string,
  lifecycleId: number,
  body: {
    channel?: 'meta' | 'google' | 'all';
    confirm_create_tasks?: boolean;
    recommendation_ids?: string[];
    dismissed_recommendation_ids?: string[];
  },
) {
  return mktAiFetch<MktAiOptimizeResult>(token, lifecycleId, '/jobs/optimize', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export interface MktAiPlaybookListResult {
  ok: boolean;
  service_slug: string;
  active_slug: string | null;
  playbooks: Array<{
    slug: string;
    label_vi: string;
    quality_gate: { min_score_launch_qa: number };
  }>;
}

export async function fetchMktAiPlaybooks(token: string, lifecycleId: number) {
  return mktAiFetch<MktAiPlaybookListResult>(token, lifecycleId, '/playbooks');
}

export async function postMktAiPlaybookApply(
  token: string,
  lifecycleId: number,
  slug: string,
  body: { confirm_overwrite?: boolean } = {},
) {
  return mktAiFetch<{
    brief: MktAiBrief;
    brief_validation: MktAiBriefValidation;
    playbook_slug: string;
    messages: string[];
  }>(token, lifecycleId, `/playbooks/${encodeURIComponent(slug)}/apply`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type MktAiPipelineStep = 'strategist' | 'planner' | 'copywriter' | 'analyst';

export interface MktAiMultiAgentBody {
  pipeline_key?: 'default_v1';
  playbook_slug?: string;
  steps?: MktAiPipelineStep[];
  skip_analyst?: boolean;
  stop_on_failure?: boolean;
  start_from_step?: MktAiPipelineStep;
  async?: boolean;
}

export interface MktAiMultiAgentAsyncResult {
  ok: boolean;
  job_id: number;
  status: 'pending';
  output: null;
  poll_url?: string;
}

export interface MktAiMultiAgentChildJobRef {
  step: MktAiPipelineStep;
  job_type: string;
  job_id: number;
  status: 'succeeded' | 'failed' | 'skipped';
  latency_ms?: number;
  error_message?: string;
}

export interface MktAiMultiAgentOutput {
  pipeline_key: string;
  playbook_slug: string | null;
  child_jobs: MktAiMultiAgentChildJobRef[];
  failed_step?: MktAiPipelineStep;
  quality_score?: number;
}

export interface MktAiMultiAgentResult {
  ok: boolean;
  job_id: number;
  status: 'succeeded' | 'partial' | 'failed';
  output: MktAiMultiAgentOutput;
  draft?: MktAiDraft;
}

export interface MktAiMultiAgentStepState {
  step: MktAiPipelineStep;
  label_vi: string;
  job_type: string;
  state: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  job_id?: number;
}

export interface MktAiMultiAgentStatusPayload {
  ok: boolean;
  parent_job: MktAiJobRow | null;
  pipeline_key: string | null;
  playbook_slug: string | null;
  rollup_status: 'idle' | 'running' | 'succeeded' | 'partial' | 'failed';
  parent_status?: string | null;
  current_step?: MktAiPipelineStep | null;
  progress_pct?: number;
  steps: MktAiMultiAgentStepState[];
  quality_score?: number;
  failed_step?: MktAiPipelineStep;
}

export type MktAiMultiAgentPostResult = MktAiMultiAgentResult | MktAiMultiAgentAsyncResult;

export async function postMktAiMultiAgentJob(
  token: string,
  lifecycleId: number,
  body: MktAiMultiAgentBody = {},
): Promise<MktAiMultiAgentPostResult> {
  return mktAiFetch<MktAiMultiAgentPostResult>(token, lifecycleId, '/jobs/multi-agent', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchMktAiMultiAgentStatus(token: string, lifecycleId: number) {
  return mktAiFetch<MktAiMultiAgentStatusPayload>(token, lifecycleId, '/multi-agent/status');
}

export interface MktAiStrategyScenarioRow {
  id: number;
  lifecycle_id: number;
  job_id: number | null;
  label: string;
  variant_slug: string;
  variant_index: number;
  strategy_framework_json: Record<string, string>;
  target_market_prof_json: Record<string, string>;
  swot_json: Record<string, unknown>;
  channel_focus_json: Record<string, string>;
  messaging_json: Record<string, string>;
  is_selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface MktAiStrategyScenarioComparePayload {
  ok: boolean;
  scenario_a: MktAiStrategyScenarioRow;
  scenario_b: MktAiStrategyScenarioRow;
  swot_diff: Record<string, { a: string[]; b: string[]; only_a: string[]; only_b: string[] }>;
  channel_diff: Record<string, { a: string; b: string; changed: boolean }>;
  messaging_diff: Record<string, { a: string; b: string; changed: boolean }>;
  fields_changed: string[];
}

export interface MktAiSectionCommentRow {
  id: number;
  lifecycle_id: number;
  section_key: string;
  author_email: string;
  body: string;
  mention_email: string | null;
  created_at: string;
  updated_at: string;
}

export type MktAiPptxExportSection = 'strategy' | 'campaign' | 'content' | 'brief';

export async function postMktAiStrategyScenariosJob(
  token: string,
  lifecycleId: number,
  count = 3,
) {
  return mktAiFetch<{ job_id: number; status: string; scenarios: MktAiStrategyScenarioRow[] }>(
    token,
    lifecycleId,
    '/jobs/strategy/scenarios',
    { method: 'POST', body: JSON.stringify({ count }) },
  );
}

export async function fetchMktAiStrategyScenarioCompare(
  token: string,
  lifecycleId: number,
  scenarioA: number,
  scenarioB: number,
) {
  const q = new URLSearchParams({ a: String(scenarioA), b: String(scenarioB) });
  return mktAiFetch<MktAiStrategyScenarioComparePayload>(
    token,
    lifecycleId,
    `/strategy/scenarios/compare?${q}`,
  );
}

export async function postMktAiSelectStrategyScenario(
  token: string,
  lifecycleId: number,
  scenarioId: number,
) {
  return mktAiFetch<{ scenario: MktAiStrategyScenarioRow; draft_updated: boolean }>(
    token,
    lifecycleId,
    `/strategy/scenarios/${scenarioId}/select`,
    { method: 'POST', body: '{}' },
  );
}

export async function postMktAiSectionComment(
  token: string,
  lifecycleId: number,
  body: { section_key: string; body: string; mention_email?: string },
) {
  return mktAiFetch<MktAiSectionCommentRow>(token, lifecycleId, '/section-comments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postMktAiExportPptx(
  token: string,
  lifecycleId: number,
  sections: MktAiPptxExportSection[] = ['strategy', 'campaign'],
) {
  return mktAiFetch<{
    format: string;
    filename: string;
    content: string;
    mime_type: string;
    encoding?: 'base64' | 'utf8';
  }>(token, lifecycleId, '/export/pptx', {
    method: 'POST',
    body: JSON.stringify({ sections }),
  });
}
