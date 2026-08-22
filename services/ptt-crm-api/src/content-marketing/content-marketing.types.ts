import type {
  CMKT_CHANNELS,
  CMKT_FORMATS,
  CMKT_ITEM_STATUSES,
  CMKT_P0_CHANNEL_DEFAULTS,
} from './content-marketing.constants';

export type CmktItemStatus = (typeof CMKT_ITEM_STATUSES)[number];
export type CmktChannel = (typeof CMKT_CHANNELS)[number];
export type CmktFormat = (typeof CMKT_FORMATS)[number];
export type CmktChannelDefault = (typeof CMKT_P0_CHANNEL_DEFAULTS)[number];

export type CmktBodyJson = {
  markdown?: string;
  html?: string;
  variants?: string[];
};

export type CmktProductionPhase =
  | 'none'
  | 'awaiting_design'
  | 'awaiting_video'
  | 'in_progress'
  | 'done';

export type CmktProductionJson = {
  phase?: CmktProductionPhase;
  assignee_designer_id?: number | null;
  assignee_video_id?: number | null;
  brief_exported_at?: string | null;
  asset_urls?: string[];
  final_video_url?: string | null;
  subtitle_text?: string | null;
  chapter_markers?: string[];
  creative_id?: string | null;
  notes?: string | null;
  escalate_human?: boolean;
  ai_assets?: CmktMediaAsset[];
};

export type CmktVisualStatus =
  | 'not_needed'
  | 'ai_pending'
  | 'ai_ready'
  | 'human_polish'
  | 'approved'
  | 'rejected';

export type CmktMediaAsset = {
  id: string;
  type: 'image' | 'carousel_slide' | 'video';
  url: string;
  ai_generated: boolean;
  provider: string;
  selected?: boolean;
  visual_qa_score?: number;
  draft_watermark?: boolean;
  slide_index?: number;
  prompt_hash?: string;
  provider_request_id?: string;
  storage_key?: string;
  clean_storage_key?: string;
  duration_sec?: number;
  poster_url?: string;
  ocr_confidence?: number;
  brand_delta_e?: number;
  pipeline_json?: Record<string, unknown>;
};

export type CmktVideoGenerationProgress = {
  progress_pct: number;
  steps: Record<string, 'pending' | 'running' | 'done' | 'failed'>;
  eta_sec?: number;
};

export type CmktVideoBeat = {
  id: 'hook' | 'pain' | 'proof' | 'cta';
  start_ms: number;
  end_ms: number;
  script_excerpt: string;
  keywords: string[];
  clip_id: string | null;
  clip_url?: string;
  license?: 'pexels' | 'storyblocks' | 'upload' | 'generated';
  on_screen_text: string;
  locked: boolean;
};

export type CmktVideoStoryboard = {
  version: 1;
  pack_default: string;
  requested_packs: string[];
  style_preset: 'corporate' | 'bold' | 'minimal' | 'playful';
  voice: { provider: string; voice_id: string; lang: 'vi' | 'en' };
  beats: CmktVideoBeat[];
  tts: { storage_key: string; duration_sec: number; url: string };
};

export type CmktVideoQaResult = {
  score: number;
  blocked: boolean;
  checks: Record<string, boolean>;
  notes?: string;
};

export type CmktMediaJson = {
  ai_assets?: CmktMediaAsset[];
  carousel_slides?: CmktMediaAsset[];
  video_short?: CmktMediaAsset | null;
  video_studio?: 'social' | 'cinematic';
  studio_locked_at?: string;
  vd_project_id?: number;
  storyboard?: CmktVideoStoryboard;
  video_packs?: Record<string, CmktMediaAsset>;
  video_qa?: CmktVideoQaResult;
  video_generation?: CmktVideoGenerationProgress;
  visual_qa?: {
    score: number;
    checks?: Record<string, boolean>;
    blocked?: boolean;
    notes?: string;
    brand_delta_e_max?: number | null;
    ocr_confidence?: number;
    contrast_ratio?: number;
  };
  style_preset?: string;
  aspect_ratio?: string;
  provider?: string;
  prompt_hash?: string;
  selected_asset_id?: string | null;
};

export type CmktVisualReviewItem = CmktItemRow & {
  visual_qa_score?: number | null;
};

export type CmktEmBridgeRef = {
  campaign_id: string;
  status: string;
  campaign_type?: string;
  href?: string;
};

export type CmktDerivationRow = {
  id: number;
  source_item_id: number;
  derived_item_id: number;
  transform_type: string;
  prompt_profile: string;
  created_at: string;
  derived_item?: CmktItemRow;
};

export type CmktIdeaRow = {
  id: number;
  lifecycle_id: number;
  pillar_id: number | null;
  title: string;
  hook: string;
  target_goal: string;
  channel_hints: string[];
  source: string;
  status: string;
  meta_json: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CmktItemRow = {
  id: number;
  lifecycle_id: number;
  idea_id: number | null;
  parent_item_id: number | null;
  title: string;
  format: string;
  channel: string;
  funnel_goal: string;
  status: string;
  assignee_sp: number | null;
  assignee_qa: number | null;
  brief_json: Record<string, unknown>;
  body_json: CmktBodyJson;
  selected_variant_idx: number | null;
  quality_score_json: Record<string, unknown>;
  seo_bridge_id: number | null;
  email_bridge_id: number | null;
  production_json: CmktProductionJson;
  visual_status: CmktVisualStatus;
  media_json: CmktMediaJson;
  published_url: string | null;
  published_at: string | null;
  due_at: string | null;
  in_review_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CmktItemVersionRow = {
  id: number;
  item_id: number;
  version_no: number;
  body_json: CmktBodyJson;
  changed_by: string;
  change_reason: string;
  ai_run_id?: string | null;
  created_at: string;
};

export type CmktSnapshotSummary = {
  id: number;
  sealed: boolean;
  pillars_count: number;
  ingested_at: string;
  marketing_plan_id: number | null;
  source_hash?: string;
  planner_drift?: boolean;
};

export type CmktContextCounts = {
  ideas: number;
  items_by_status: Record<string, number>;
  draft: number;
  in_review: number;
  published_mtd: number;
  scheduled_this_week: number;
  in_review_sla_breach: number;
};

export type CmktContextFlags = {
  ai_enabled: boolean;
  approval_required: boolean;
  media_enabled: boolean;
  image_gen_enabled: boolean;
  video_gen_enabled: boolean;
  client_gate: boolean;
  portal_summary_enabled: boolean;
  fe_enabled: boolean;
  weekly_memo_enabled: boolean;
  external_metrics_enabled: boolean;
  brief_gate_enabled: boolean;
  pii_consent: boolean;
};

export type CmktContextPayload = {
  ok: boolean;
  lifecycle_id: number;
  service_slug: string;
  stage: string;
  enabled: boolean;
  snapshot: CmktSnapshotSummary | null;
  counts: CmktContextCounts;
  flags: CmktContextFlags;
  channel_defaults: CmktChannelDefault[];
  email_client_id: string | null;
  email_client_linked: boolean;
};

export type CmktActiveSnapshotRow = {
  id: number;
  sealed: boolean;
  ingested_at: Date;
  marketing_plan_id: number | null;
  pillars_count: number;
  source_hash: string;
  ingested_by: string;
  snapshot_json: Record<string, unknown>;
  brand_context_json: Record<string, unknown>;
};

export type CmktPillarRow = {
  id: number;
  lifecycle_id: number;
  snapshot_id: number | null;
  name: string;
  goal: string;
  topics_json: string[];
  sort_order: number;
  active: boolean;
};

export type CmktIngestResult = {
  ok: boolean;
  snapshot_id: number;
  ideas_created: number;
  pillars_upserted: number;
  warnings: string[];
};

export type CmktJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type CmktJobRow = {
  id: number;
  lifecycle_id: number;
  item_id: number | null;
  job_type: string;
  status: CmktJobStatus;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_text: string | null;
  ai_run_id: string | null;
  created_by: string;
  created_at: string;
  finished_at: string | null;
};

export type CmktReviewQueueItem = CmktItemRow & {
  sla_breach: boolean;
  scheduled_at?: string | null;
};

export type CmktReviewQueueSummary = {
  total: number;
  sla_breach: number;
  by_channel: Record<string, number>;
  sla_target_hours: number;
  max_hours_in_review: number | null;
  avg_hours_in_review: number | null;
};

export type CmktCalendarSlotRow = {
  id: number;
  lifecycle_id: number;
  item_id: number;
  scheduled_at: string;
  timezone: string;
  reminder_sent: boolean;
  item?: CmktItemRow;
};

export type CmktRepurposeTarget = {
  channel: string;
  format: string;
  count?: number;
};

export type CmktRepurposeResult = {
  ok: boolean;
  source_item_id: number;
  derived_items: CmktItemRow[];
  derivations: CmktDerivationRow[];
  jobs: CmktJobRow[];
};

export type CmktBridgeSeoStatus = {
  linked: boolean;
  seo_content_id: number | null;
  workflow_status: string | null;
  href: string | null;
};

export type CmktBridgeEmailStatus = {
  linked: boolean;
  campaign_id: string | null;
  status: string | null;
  href: string | null;
};

export type CmktAuditRow = {
  item_id: number;
  item_title: string;
  version_no: number;
  change_reason: string;
  changed_by: string;
  created_at: string;
  ai_run_id: string | null;
  agent_name?: string | null;
  use_case?: string | null;
};

export type CmktCommentRow = {
  id: number;
  item_id: number;
  author_id: string;
  body: string;
  visibility: string;
  created_at: string;
};

export type CmktMetricRow = {
  id: number;
  item_id: number;
  channel: string;
  metric_date: string;
  impressions: number | null;
  engagements: number | null;
  clicks: number | null;
  leads: number | null;
  source: string;
  raw_json: Record<string, unknown>;
  created_at: string;
};

export type CmktMetricWithItemRow = CmktMetricRow & {
  item_title: string;
  item_status: string;
};

export type CmktExternalChannelMetrics = {
  source: string;
  linked_items: number;
  impressions?: number;
  engagements?: number;
  clicks?: number;
  leads?: number;
  open_rate_pct?: number;
  emails_sent?: number;
  note?: string;
};

export type CmktExternalMetricsSummary = {
  enabled: boolean;
  sources: string[];
  by_channel: Record<string, CmktExternalChannelMetrics>;
};

export type CmktIntelligenceChannelStats = {
  published: number;
  avg_engagement?: number;
  impressions?: number;
  engagements?: number;
  clicks?: number;
  leads?: number;
  external_source?: string;
  external_metrics?: CmktExternalChannelMetrics;
};

export type CmktWeeklyMemoSection = {
  heading: string;
  bullets: string[];
};

export type CmktWeeklyMemoPayload = {
  title: string;
  body_vi: string;
  sections: CmktWeeklyMemoSection[];
  week_label: string;
  auto_apply: boolean;
};

export type CmktWeeklyMemoPreview = {
  title: string;
  body_vi: string;
  generated_at: string;
  job_id: number;
};

export type CmktApplySuggestionsResult = {
  ok: boolean;
  ideas_created: number;
  idea_ids: number[];
  ideas: CmktIdeaRow[];
};

export type CmktIntelligenceResponse = {
  range: string;
  from_date: string;
  to_date: string;
  by_channel: Record<string, CmktIntelligenceChannelStats>;
  top_items: Array<{ item_id: number; title: string; score: number; channel: string }>;
  suggestions: string[];
  metrics_count: number;
  external_metrics?: CmktExternalMetricsSummary;
  weekly_memo?: CmktWeeklyMemoPreview | null;
};

export type CmktMetricsSummaryResponse = {
  range: string;
  from_date: string;
  to_date: string;
  totals: {
    impressions: number;
    engagements: number;
    clicks: number;
    leads: number;
  };
  by_channel: Record<string, CmktIntelligenceChannelStats>;
  entries_count: number;
};

export type CmktVersionComparePayload = {
  item_id: number;
  v1: number;
  v2: number;
  lines: Array<{ type: 'add' | 'del' | 'same'; text: string }>;
};

export type CmktPlanSnapshotPayload = {
  snapshot: {
    id: number;
    lifecycle_id: number;
    marketing_plan_id: number | null;
    sealed: boolean;
    source_hash: string;
    ingested_at: string;
    ingested_by: string;
    snapshot_json: Record<string, unknown>;
    brand_context_json: Record<string, unknown>;
  } | null;
  pillars: CmktPillarRow[];
  planner: {
    marketing_plan_id: number | null;
    has_applied_plan: boolean;
    current_source_hash: string | null;
    drift: boolean;
  };
};
