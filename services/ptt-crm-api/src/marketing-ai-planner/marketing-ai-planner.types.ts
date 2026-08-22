export type MktAiJobType =
  | 'brief_summarize'
  | 'strategy_generate'
  | 'campaign_generate'
  | 'content_generate'
  | 'quality_score'
  | 'apply_to_tmmt'
  | 'budget_simulate'
  | 'optimize'
  | 'weekly_memo'
  | 'competitor_snapshot'
  | 'multi_agent'
  | 'strategy_scenarios';

export type MktAiJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface MktAiBrief {
  brand_name?: string;
  industry?: string;
  service_slug?: string;
  objective?: 'lead' | 'awareness' | 'sales' | 'retention' | string;
  budget_monthly_vnd?: number;
  geo_markets?: string[];
  competitors?: string[];
  challenges?: string;
  usp?: string;
  website_url?: string;
  timeline_start?: string;
  timeline_end?: string;
  notes?: string;
  /** When true (default), strategy generation uses indexed Brand KB chunks. */
  use_rag?: boolean;
  /** Internal metadata — industry playbook slug applied to brief. */
  _playbook_slug?: string;
}

export type MktAiDocumentStatus =
  | 'pending'
  | 'indexing'
  | 'indexed'
  | 'failed'
  | 'archived';

export interface MktAiDocumentRow {
  id: number;
  lifecycle_id: number;
  filename: string;
  mime_type: string;
  file_size_bytes: number | null;
  status: MktAiDocumentStatus;
  chunk_count: number;
  error_message: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  metadata_json?: Record<string, unknown>;
}

export interface MktAiRagChunkHit {
  chunk_id: number;
  document_id: number;
  chunk_index: number;
  page_no: number | null;
  filename: string;
  title: string;
  body: string;
  rank: number;
}

export interface MktAiCitation {
  chunk_id: number;
  document_id: number;
  filename: string;
  page_no: number | null;
  section_key?: string;
  excerpt?: string;
}

export interface MktAiBudgetScenarioRow {
  id: number;
  lifecycle_id: number;
  job_id: number | null;
  name: string;
  slug: string;
  budget_monthly_vnd: number;
  channel_mix_json: Record<string, number>;
  cpl_estimates_json: Record<string, number>;
  assumptions_json: Record<string, unknown>;
  rationale_vi?: string | null;
  is_selected: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
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

export interface MktAiCampaignDraft {
  name: string;
  objective: string;
  channel_mix: string[];
  budget_pct: number;
  timeline_weeks?: string;
  milestones?: string[];
  kpis?: string[];
}

export interface MktAiJobRow {
  id: number;
  lifecycle_id: number;
  job_type: MktAiJobType;
  status: MktAiJobStatus;
  prompt_version: string;
  model_name: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_message: string | null;
  latency_ms: number | null;
  actor_email: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
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
    pilot_only?: boolean;
    auto_customer_email_enabled?: boolean;
  };
  pilot?: {
    pilot_only: boolean;
    pilot_dv_codes: readonly string[];
    service_slug_in_pilot: boolean;
    ga_blocked_message_vi: string | null;
  };
  customer_email_policy_vi?: string;
  strategy_scenarios?: MktAiStrategyScenarioRow[];
  section_comments?: MktAiSectionCommentRow[];
  documents?: MktAiDocumentRow[];
  rag?: { use_rag: boolean; indexed_count: number };
  budget_scenarios?: MktAiBudgetScenarioRow[];
  approval?: MktAiApprovalContext;
  comments?: MktAiCommentRow[];
  plan_versions?: MktAiPlanVersionSummary[];
}

export interface MktAiPlanVersionSummary {
  id: number;
  version_no: number;
  label: string;
  status: MktAiPlanVersionStatus;
  created_by: string;
  created_at: string;
  quality_score: number | null;
  campaign_count: number;
}

export type MktAiApprovalStatus =
  | 'pending'
  | 'approved'
  | 'changes_requested'
  | 'rejected'
  | 'cancelled';

export type MktAiPlanVersionStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'applied'
  | 'archived';

export interface MktAiPlanVersionRow {
  id: number;
  lifecycle_id: number;
  version_no: number;
  label: string;
  status: MktAiPlanVersionStatus;
  brief_json: MktAiBrief;
  strategy_framework_json: Record<string, string>;
  target_market_prof_json: Record<string, string>;
  campaigns_json: MktAiCampaignDraft[];
  content_json: Record<string, unknown>;
  quality_score_json: Record<string, unknown>;
  marketing_plan_id: number | null;
  applied_at: string | null;
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
  created_at: string;
  updated_at: string;
  plan_version?: MktAiPlanVersionRow;
}

export interface MktAiCommentRow {
  id: number;
  lifecycle_id: number;
  plan_version_id: number | null;
  approval_id: number | null;
  author_email: string;
  body: string;
  anchor_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MktAiApprovalContext {
  required: boolean;
  latest: MktAiApprovalRow | null;
  can_export: boolean;
  can_submit: boolean;
}

export interface MktAiDashboardTrendWeek {
  week_label: string;
  week_start: string;
  spend_vnd: number;
  leads: number;
  cpl: number | null;
  roas: number | null;
  roas_stub: boolean;
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
  trend: MktAiDashboardTrendWeek[];
  deltas: {
    cpl_vs_target_pct: number | null;
    spend_vs_prev_week_pct: number | null;
  };
  flags: { perf_tables_ready: boolean };
  messages: string[];
}

export interface MktAiOptimizeRecommendation {
  id: string;
  title: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  suggested_task: { stage: string; title: string; description: string };
}

export interface MktAiOptimizeBody {
  channel?: 'meta' | 'google' | 'all';
  confirm_create_tasks?: boolean;
  recommendation_ids?: string[];
  dismissed_recommendation_ids?: string[];
}

export interface MktAiOptimizeKpiContext {
  cpl_delta_pct: number | null;
  spend_vs_prev_week_pct: number | null;
  spend_mtd_vnd: number;
  leads_mtd: number;
  cpl_mtd: number | null;
  roas_mtd: number | null;
  roas_stub: boolean;
  linked: boolean;
  target_cpl_vnd: number | null;
}

export type MktAiKpiClosedLoopMetricKind = 'cpl' | 'leads' | 'roas' | 'spend' | 'other';

export interface MktAiKpiClosedLoopRow {
  id: string;
  label: string;
  metric_kind: MktAiKpiClosedLoopMetricKind;
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

export interface MktAiWeeklyMemoSection {
  heading: string;
  bullets: string[];
}

export interface MktAiWeeklyMemoPayload {
  title: string;
  body_vi: string;
  sections: MktAiWeeklyMemoSection[];
  week_label: string;
  auto_apply: false;
}

export interface MktAiWeeklyMemoResult {
  ok: boolean;
  job_id: number;
  status: string;
  memo: MktAiWeeklyMemoPayload;
  notification_sent?: boolean;
  skipped?: boolean;
  reason?: string;
}

export interface MktAiWeeklyMemoCronRunResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  scanned: number;
  memos_generated: number;
  notifications_sent: number;
  skipped_dedupe: number;
  errors: string[];
}

export interface MktAiPlaybookApplyBody {
  confirm_overwrite?: boolean;
}

export interface MktAiPlaybookApplyResult {
  brief: MktAiBrief;
  brief_validation: MktAiBriefValidation;
  playbook_slug: string;
  messages: string[];
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

export type MktAiPipelineStep = 'strategist' | 'planner' | 'copywriter' | 'analyst';

export interface MktAiMultiAgentBody {
  pipeline_key?: 'default_v1';
  playbook_slug?: string;
  steps?: MktAiPipelineStep[];
  skip_analyst?: boolean;
  stop_on_failure?: boolean;
  start_from_step?: MktAiPipelineStep;
  /** When true (or env default), enqueue parent job and return HTTP 202. */
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
  job_type: MktAiJobType;
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
  job_type: MktAiJobType;
  state: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  job_id?: number;
}

export interface MktAiMultiAgentStatusPayload {
  ok: boolean;
  parent_job: MktAiJobRow | null;
  pipeline_key: string | null;
  playbook_slug: string | null;
  rollup_status: 'idle' | 'running' | 'succeeded' | 'partial' | 'failed';
  parent_status?: MktAiJobStatus | null;
  current_step?: MktAiPipelineStep | null;
  progress_pct?: number;
  steps: MktAiMultiAgentStepState[];
  quality_score?: number;
  failed_step?: MktAiPipelineStep;
}

export interface MktAiOptimizeResult {
  ok: boolean;
  job_id: number;
  status: 'succeeded' | 'failed';
  kpi_context: MktAiOptimizeKpiContext;
  recommendations: MktAiOptimizeRecommendation[];
  tasks_created?: Array<{ task_id: number; title: string; recommendation_id: string }>;
}

export type MktAiStrategyVariantSlug = 'conservative' | 'balanced' | 'aggressive';

export interface MktAiStrategyScenarioRow {
  id: number;
  lifecycle_id: number;
  job_id: number | null;
  label: string;
  variant_slug: MktAiStrategyVariantSlug | string;
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

export interface MktAiPptxExportBody {
  sections?: MktAiPptxExportSection[];
}

export const REQUIRED_BRIEF_FIELDS = [
  'brand_name',
  'industry',
  'service_slug',
  'objective',
  'budget_monthly_vnd',
  'geo_markets',
  'challenges',
] as const;

export const BRIEF_FIELD_LABELS: Record<string, string> = {
  brand_name: 'Tên thương hiệu / KH',
  industry: 'Ngành',
  service_slug: 'Dịch vụ RNOSAI',
  objective: 'Mục tiêu chiến dịch',
  budget_monthly_vnd: 'Ngân sách tháng (VND)',
  geo_markets: 'Thị trường / Geo',
  challenges: 'Thách thức / pain',
};
