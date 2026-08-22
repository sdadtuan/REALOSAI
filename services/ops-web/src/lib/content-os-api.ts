import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function cmktFetch<T>(
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
    `${API_BASE}/api/crm/service-lifecycle/${lifecycleId}/content-marketing${path}`,
    { ...init, headers },
  );
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new CmktApiError(
      body.message ?? body.error ?? 'Content OS request failed',
      res.status,
      body.error,
      body as Record<string, unknown>,
    );
  }
  return body;
}

export class CmktApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    readonly code?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message, status);
    this.name = 'CmktApiError';
  }
}

export function parseCmktGateError(err: unknown): string {
  if (err instanceof CmktApiError && err.code) {
    switch (err.code) {
      case 'visual_not_approved':
        return 'Không thể publish — cần duyệt visual (tab Media AI).';
      case 'production_not_done':
        return 'Không thể publish — cần hoàn tất production (tab Production).';
      case 'invalid_transition':
        return 'Chuyển trạng thái không hợp lệ — kiểm tra workflow item.';
      case 'body_required':
        return 'Nội dung body không được trống trước khi submit.';
      case 'reject_comment_required':
        return 'Comment từ chối tối thiểu 10 ký tự.';
      case 'media_copy_not_approved':
        return 'Media job chỉ chạy sau khi copy được duyệt nội bộ.';
      case 'brief_incomplete':
        return 'Brief thiếu audience hoặc goal — bổ sung trước khi generate.';
      case 'regenerate_body_required':
        return 'Cần nội dung draft trước khi regenerate.';
      case 'studio_locked':
        return 'Studio đã khóa — tạo item video mới (clone script) nếu cần đổi.';
      case 'studio_mismatch':
        return 'Studio không khớp — item này không dùng pipeline đang gọi.';
      case 'video_daily_cap':
        return 'Hết quota video trong ngày cho lifecycle này.';
      case 'storyboard_required':
        return 'Cần tạo storyboard trước khi render.';
      default:
        break;
    }
  }
  if (err instanceof Error) return err.message;
  return 'Thao tác thất bại';
}

export type ContentOsContext = {
  ok: boolean;
  lifecycle_id: number;
  service_slug: string;
  stage: string;
  enabled: boolean;
  snapshot?: {
    id: number;
    sealed: boolean;
    pillars_count: number;
    ingested_at: string;
    marketing_plan_id: number | null;
    source_hash?: string;
    planner_drift?: boolean;
  } | null;
  counts: {
    ideas: number;
    items_by_status: Record<string, number>;
    draft: number;
    in_review: number;
    published_mtd: number;
    scheduled_this_week: number;
    in_review_sla_breach: number;
  };
  flags: {
    ai_enabled: boolean;
    approval_required: boolean;
    media_enabled: boolean;
    image_gen_enabled: boolean;
    video_gen_enabled: boolean;
    client_gate: boolean;
    portal_summary_enabled: boolean;
    fe_enabled: boolean;
    brief_gate_enabled?: boolean;
    pii_consent?: boolean;
  };
  channel_defaults: string[];
  email_client_id: string | null;
  email_client_linked: boolean;
};

export type ContentOsIdea = {
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

export type ContentOsItem = {
  id: number;
  lifecycle_id: number;
  idea_id: number | null;
  parent_item_id?: number | null;
  title: string;
  format: string;
  channel: string;
  funnel_goal: string;
  status: string;
  assignee_sp?: number | null;
  assignee_qa?: number | null;
  brief_json: Record<string, unknown>;
  body_json: { markdown?: string; html?: string; variants?: string[] };
  selected_variant_idx: number | null;
  seo_bridge_id?: number | null;
  email_bridge_id?: number | null;
  production_json?: Record<string, unknown>;
  visual_status?: string;
  media_json?: ContentOsMediaJson;
  in_review_at?: string | null;
  published_url?: string | null;
  published_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export const CMKT_P0_PAIRS = [
  { channel: 'website', format: 'blog', label: 'Website / Blog' },
  { channel: 'facebook', format: 'social_post', label: 'Facebook — bài viết' },
  { channel: 'facebook', format: 'carousel', label: 'Facebook — carousel' },
  { channel: 'linkedin', format: 'social_post', label: 'LinkedIn — bài viết' },
  { channel: 'linkedin', format: 'carousel', label: 'LinkedIn — carousel' },
] as const;

export function fetchContentOsContext(token: string, lifecycleId: number): Promise<ContentOsContext> {
  return cmktFetch(token, lifecycleId, '/context');
}

export function fetchContentOsIdeas(
  token: string,
  lifecycleId: number,
  params?: { status?: string },
): Promise<{ ideas: ContentOsIdea[] }> {
  const q = params?.status ? `?status=${encodeURIComponent(params.status)}` : '';
  return cmktFetch(token, lifecycleId, `/ideas${q}`);
}

export function postContentOsIdea(
  token: string,
  lifecycleId: number,
  body: { title: string; hook?: string; target_goal?: string },
): Promise<ContentOsIdea> {
  return cmktFetch(token, lifecycleId, '/ideas', { method: 'POST', body: JSON.stringify(body) });
}

export function postContentOsIdeaConvert(
  token: string,
  lifecycleId: number,
  ideaId: number,
  body: { channel: string; format: string; title?: string },
): Promise<{ idea: ContentOsIdea; item: ContentOsItem }> {
  return cmktFetch(token, lifecycleId, `/ideas/${ideaId}/convert`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchContentOsItems(
  token: string,
  lifecycleId: number,
  params?: { status?: string; format?: string; assignee?: number | 'me' },
): Promise<{ items: ContentOsItem[] }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.format) qs.set('format', params.format);
  if (params?.assignee === 'me') qs.set('assignee', 'me');
  else if (params?.assignee != null) qs.set('assignee', String(params.assignee));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return cmktFetch(token, lifecycleId, `/items${suffix}`);
}

export function fetchContentOsItem(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}`);
}

export function patchContentOsItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: Record<string, unknown>,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function patchContentOsItemAssignees(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { assignee_sp?: number | null; assignee_qa?: number | null },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/assignees`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export type ContentOsComment = {
  id: number;
  item_id: number;
  author_id: string;
  body: string;
  visibility: string;
  created_at: string;
};

export function fetchContentOsItemComments(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ comments: ContentOsComment[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/comments`);
}

export function postContentOsItemComment(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { body: string; visibility?: 'internal' | 'client' },
): Promise<{ comment: ContentOsComment }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/comments`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type ContentOsVersionDiffLine = {
  type: 'add' | 'del' | 'same';
  text: string;
};

export function fetchContentOsVersionCompare(
  token: string,
  lifecycleId: number,
  itemId: number,
  v1: number,
  v2: number,
): Promise<{ item_id: number; v1: number; v2: number; lines: ContentOsVersionDiffLine[] }> {
  const qs = new URLSearchParams({ v1: String(v1), v2: String(v2) });
  return cmktFetch(token, lifecycleId, `/items/${itemId}/versions/compare?${qs.toString()}`);
}

export function channelFormatLabel(channel: string, format: string): string {
  const hit = CMKT_P0_PAIRS.find((p) => p.channel === channel && p.format === format);
  return hit?.label ?? `${channel} / ${format}`;
}

export type ContentOsPillar = {
  id: number;
  lifecycle_id: number;
  snapshot_id: number | null;
  name: string;
  goal: string;
  topics_json: string[];
  sort_order: number;
  active: boolean;
};

export type ContentOsPlanSnapshot = {
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
  pillars: ContentOsPillar[];
  planner: {
    marketing_plan_id: number | null;
    has_applied_plan: boolean;
    current_source_hash: string | null;
    drift: boolean;
  };
};

export type ContentOsIngestResult = {
  ok: boolean;
  snapshot_id: number;
  ideas_created: number;
  pillars_upserted: number;
  warnings: string[];
};

export function fetchPlanSnapshot(token: string, lifecycleId: number): Promise<ContentOsPlanSnapshot> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot');
}

export type ContentOsDriftDiff = {
  drift: boolean;
  can_reingest: boolean;
  pillars: {
    added: Array<{ name: string; goal: string; topics?: string[] }>;
    removed: Array<{ name: string; goal: string; topics?: string[] }>;
    changed: Array<{ name: string; field: string; before: string; after: string }>;
  };
  calendar: {
    added: Array<{ title: string; date: string; channel: string }>;
    removed: Array<{ title: string; date: string; channel: string }>;
    changed: Array<{ title: string; field: string; before: string; after: string }>;
  };
};

export function fetchPlanSnapshotDriftDiff(
  token: string,
  lifecycleId: number,
): Promise<ContentOsDriftDiff> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot/drift-diff');
}

export function postContentOsItem(
  token: string,
  lifecycleId: number,
  body: {
    title: string;
    channel: string;
    format: string;
    funnel_goal?: string;
    brief_json?: Record<string, unknown>;
  },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, '/items', { method: 'POST', body: JSON.stringify(body) });
}

export function fetchContentOsPillars(
  token: string,
  lifecycleId: number,
): Promise<{ pillars: ContentOsPillar[] }> {
  return cmktFetch(token, lifecycleId, '/pillars');
}

export function patchContentOsPillar(
  token: string,
  lifecycleId: number,
  pillarId: number,
  body: { name?: string; goal?: string; topics_json?: string[]; sort_order?: number },
): Promise<{ pillar: ContentOsPillar }> {
  return cmktFetch(token, lifecycleId, `/pillars/${pillarId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function postContentOsIdeasBulkJob(
  token: string,
  lifecycleId: number,
  body?: { idea_count?: number; month_label?: string },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, '/jobs/ideas-bulk', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postPlanSnapshotIngest(
  token: string,
  lifecycleId: number,
  body: {
    marketing_plan_id?: number;
    mode?: 'merge' | 'replace';
    import_calendar?: boolean;
    import_pillars?: boolean;
  },
): Promise<ContentOsIngestResult> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot/ingest', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postPlanSnapshotSeal(
  token: string,
  lifecycleId: number,
): Promise<{ ok: boolean; snapshot_id: number; sealed: boolean }> {
  return cmktFetch(token, lifecycleId, '/plan-snapshot/seal', { method: 'POST', body: '{}' });
}

export type ContentOsJob = {
  id: number;
  lifecycle_id: number;
  item_id: number | null;
  job_type: string;
  status: string;
  input_json: Record<string, unknown>;
  output_json: Record<string, unknown>;
  error_text: string | null;
  ai_run_id: string | null;
  created_by: string;
  created_at: string;
  finished_at: string | null;
};

export type ContentOsItemVersion = {
  id: number;
  item_id: number;
  version_no: number;
  body_json: ContentOsItem['body_json'];
  changed_by: string;
  change_reason: string;
  ai_run_id?: string | null;
  created_at: string;
};

export function postContentOsDraftJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    tone?: string;
    length?: string;
    goal?: string;
    include_outline?: boolean;
    variant_count?: number;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/draft`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsVariantsJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: { tone?: string; goal?: string; variant_count?: number },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/variants`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsRegenerateJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    mode?: 'rewrite' | 'refresh';
    reason?: string;
    tone?: string;
    length?: string;
    goal?: string;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/regenerate`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function fetchContentOsJob(
  token: string,
  lifecycleId: number,
  jobId: number,
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/jobs/${jobId}`);
}

export function fetchContentOsItemVersions(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ versions: ContentOsItemVersion[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/versions`);
}

export function patchContentOsItemApplyVariant(
  token: string,
  lifecycleId: number,
  itemId: number,
  selectedVariantIdx: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ selected_variant_idx: selectedVariantIdx, apply_variant: true }),
  });
}

export type ContentOsReviewQueueItem = ContentOsItem & { sla_breach: boolean };

export function fetchContentOsReviewQueue(
  token: string,
  lifecycleId: number,
  params?: { sla_breach?: boolean; channel?: string },
): Promise<{ items: ContentOsReviewQueueItem[] }> {
  const q = new URLSearchParams();
  if (params?.sla_breach) q.set('sla_breach', '1');
  if (params?.channel) q.set('channel', params.channel);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return cmktFetch(token, lifecycleId, `/review-queue${suffix}`);
}

export function fetchContentOsReviewQueueSummary(
  token: string,
  lifecycleId: number,
): Promise<{
  total: number;
  sla_breach: number;
  by_channel: Record<string, number>;
  sla_target_hours: number;
  max_hours_in_review: number | null;
  avg_hours_in_review: number | null;
}> {
  return cmktFetch(token, lifecycleId, '/review-queue/summary');
}

export function postContentOsSubmitReview(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/submit-review`, { method: 'POST', body: '{}' });
}

export function postContentOsApproveItem(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/approve`, { method: 'POST', body: '{}' });
}

export function postContentOsRejectItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  comment: string,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function postContentOsPublishItem(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: { published_url?: string },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/publish`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export type ContentOsCalendarSlot = {
  id: number;
  lifecycle_id: number;
  item_id: number;
  scheduled_at: string;
  timezone: string;
  reminder_sent: boolean;
  item?: ContentOsItem;
};

export function fetchContentOsCalendar(
  token: string,
  lifecycleId: number,
  params?: { from?: string; to?: string },
): Promise<{ slots: ContentOsCalendarSlot[] }> {
  const q = new URLSearchParams();
  if (params?.from) q.set('from', params.from);
  if (params?.to) q.set('to', params.to);
  const suffix = q.toString() ? `?${q.toString()}` : '';
  return cmktFetch(token, lifecycleId, `/calendar${suffix}`);
}

export function putContentOsCalendarSlot(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { scheduled_at: string; timezone?: string },
): Promise<{ slot: ContentOsCalendarSlot; item: ContentOsItem }> {
  return cmktFetch(token, lifecycleId, `/calendar/slots/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export type ContentOsAuditRow = {
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

export function fetchContentOsAudit(
  token: string,
  lifecycleId: number,
  limit = 50,
): Promise<{ audit: ContentOsAuditRow[] }> {
  return cmktFetch(token, lifecycleId, `/audit?limit=${limit}`);
}

export function copyCaptionText(item: ContentOsItem): string {
  const md = String(item.body_json?.markdown ?? '').trim();
  const lines = md.split('\n').filter(Boolean);
  return lines[0] ?? md;
}

export type ContentOsRepurposeTarget = { channel: string; format: string; count?: number };

export type ContentOsDerivation = {
  id: number;
  source_item_id: number;
  derived_item_id: number;
  transform_type: string;
  prompt_profile: string;
  created_at: string;
  derived_item?: ContentOsItem;
};

export function postContentOsRepurpose(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { targets: ContentOsRepurposeTarget[]; optimize_hooks?: boolean },
): Promise<{ ok: boolean; derived_items: ContentOsItem[]; derivations: ContentOsDerivation[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/repurpose`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchContentOsDerivations(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ derivations: ContentOsDerivation[] }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/derivations`);
}

export function postContentOsBridgeSeo(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; item: ContentOsItem; seo_content_id: number; href: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/seo`, { method: 'POST', body: '{}' });
}

export function fetchContentOsBridgeSeoStatus(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ linked: boolean; seo_content_id: number | null; workflow_status: string | null; href: string | null }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/seo/status`);
}

export function postContentOsBridgeEmail(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { client_id?: string; template_id?: string; segment_id?: string; email_type?: string },
): Promise<{ ok: boolean; item: ContentOsItem; campaign_id: string; href: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/email`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function fetchContentOsBridgeEmailStatus(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ linked: boolean; campaign_id: string | null; status: string | null; href: string | null }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/email/status`);
}

export function patchContentOsProduction(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: Record<string, unknown>,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/production`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function postContentOsProductionDone(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/production/done`, { method: 'POST', body: '{}' });
}

export function postContentOsExportDesignBrief(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; filename: string; content: string; content_type: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/export/brief-design`, { method: 'POST', body: '{}' });
}

export function postContentOsExportDesignBriefPdf(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; filename: string; content_base64: string; content_type: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/export/brief-design/pdf`, {
    method: 'POST',
    body: '{}',
  });
}

export function postContentOsSeoSync(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ synced: boolean; item: ContentOsItem; published_url?: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/bridge/seo/sync`, { method: 'POST', body: '{}' });
}

export function postContentOsExportScript(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<{ ok: boolean; filename: string; content: string; content_type: string }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/export/script`, { method: 'POST', body: '{}' });
}

export function getEmBridgeHref(item: ContentOsItem): string | null {
  const ref = item.brief_json?.em_bridge as { href?: string; campaign_id?: string } | undefined;
  if (ref?.href) return ref.href;
  if (ref?.campaign_id) return `/email/campaigns/${ref.campaign_id}`;
  return null;
}

export type ContentOsMediaAsset = {
  id: string;
  type: 'image' | 'carousel_slide' | 'video';
  url: string;
  ai_generated: boolean;
  provider: string;
  selected?: boolean;
  visual_qa_score?: number;
  draft_watermark?: boolean;
  slide_index?: number;
  provider_request_id?: string;
  storage_key?: string;
  clean_storage_key?: string;
  duration_sec?: number;
  poster_url?: string;
  ocr_confidence?: number;
  brand_delta_e?: number;
};

export type ContentOsVideoStudio = 'social' | 'cinematic';

export type ContentOsVideoBeat = {
  id: 'hook' | 'pain' | 'proof' | 'cta';
  start_ms?: number;
  end_ms?: number;
  script_excerpt: string;
  keywords?: string[];
  clip_id: string | null;
  clip_url?: string;
  license?: string;
  on_screen_text?: string;
  locked?: boolean;
};

export type ContentOsVideoStoryboard = {
  version?: 1;
  pack_default: string;
  requested_packs?: string[];
  style_preset?: string;
  voice?: { provider: string; voice_id: string; lang: 'vi' | 'en' };
  beats: ContentOsVideoBeat[];
  tts?: { storage_key: string; duration_sec: number; url: string };
};

export type ContentOsVideoQa = {
  score: number;
  blocked: boolean;
  checks: Record<string, boolean>;
  notes?: string;
};

export type ContentOsMediaJson = {
  ai_assets?: ContentOsMediaAsset[];
  carousel_slides?: ContentOsMediaAsset[];
  video_short?: ContentOsMediaAsset | null;
  video_studio?: ContentOsVideoStudio;
  studio_locked_at?: string;
  storyboard?: ContentOsVideoStoryboard;
  video_packs?: Record<string, ContentOsMediaAsset>;
  video_qa?: ContentOsVideoQa;
  video_generation?: {
    progress_pct: number;
    steps: Record<string, 'pending' | 'running' | 'done' | 'failed'>;
    eta_sec?: number;
  };
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
  selected_asset_id?: string | null;
};

export const CONTENT_OS_VIDEO_API_PATHS = {
  lockStudio: (itemId: number) => `/items/${itemId}/video/lock-studio`,
  storyboard: (itemId: number) => `/items/${itemId}/jobs/video-storyboard`,
  patchStoryboard: (itemId: number) => `/items/${itemId}/video/storyboard`,
  render: (itemId: number) => `/items/${itemId}/jobs/video-render`,
} as const;

export function isVideoMediaAsset(asset: Pick<ContentOsMediaAsset, 'type' | 'url'>): boolean {
  if (asset.type === 'video') return true;
  const path = asset.url.split('?')[0]?.toLowerCase() ?? '';
  return path.endsWith('.mp4');
}

export function itemIsVideoStudioEligible(item: Pick<ContentOsItem, 'format' | 'channel'>): boolean {
  return item.format === 'video_script' || item.channel === 'short_video';
}

export type ContentOsVisualReviewItem = ContentOsItem & {
  visual_qa_score?: number | null;
};

export function fetchContentOsVisualReviewQueue(
  token: string,
  lifecycleId: number,
): Promise<{ items: ContentOsVisualReviewItem[] }> {
  return cmktFetch(token, lifecycleId, '/visual-review-queue');
}

export function postContentOsImageGenerateJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    variant_count?: number;
    aspect_ratio?: string;
    style_preset?: string;
    use_approved_copy_overlay?: boolean;
    include_logo_overlay?: boolean;
    allow_draft_watermark?: boolean;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/image-generate`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsCarouselSlidesJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    aspect_ratio?: string;
    style_preset?: string;
    allow_draft_watermark?: boolean;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/carousel-slides`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsVisualQaJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: Record<string, unknown>,
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/visual-qa`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsVideoShortJob(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    aspect_ratio?: string;
    style_preset?: string;
    allow_draft_watermark?: boolean;
    pack_default?: string;
    requested_packs?: string[];
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/jobs/video-short`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function lockVideoStudio(
  token: string,
  lifecycleId: number,
  itemId: number,
  studio: ContentOsVideoStudio,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, CONTENT_OS_VIDEO_API_PATHS.lockStudio(itemId), {
    method: 'POST',
    body: JSON.stringify({ studio }),
  });
}

export function postSocialStoryboard(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    pack_default?: string;
    requested_packs?: string[];
    style_preset?: string;
    voice?: { provider?: string; voice_id?: string; lang?: 'vi' | 'en' };
    allow_draft_watermark?: boolean;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, CONTENT_OS_VIDEO_API_PATHS.storyboard(itemId), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function patchSocialStoryboard(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: { beats: Array<Partial<ContentOsVideoBeat> & { id: ContentOsVideoBeat['id'] }> },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, CONTENT_OS_VIDEO_API_PATHS.patchStoryboard(itemId), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function postSocialRender(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: {
    pack_default?: string;
    requested_packs?: string[];
    style_preset?: string;
    allow_draft_watermark?: boolean;
  },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, CONTENT_OS_VIDEO_API_PATHS.render(itemId), {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsSubmitClient(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/submit-client`, { method: 'POST', body: '{}' });
}

export function postContentOsClientApprove(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/client-approve`, { method: 'POST', body: '{}' });
}

export function patchContentOsMediaSelect(
  token: string,
  lifecycleId: number,
  itemId: number,
  assetId: string,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/media/select`, {
    method: 'PATCH',
    body: JSON.stringify({ asset_id: assetId }),
  });
}

export function postContentOsVisualSubmitReview(
  token: string,
  lifecycleId: number,
  itemId: number,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/visual/submit-review`, {
    method: 'POST',
    body: '{}',
  });
}

export function postContentOsVisualApprove(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: { comment?: string; override?: boolean },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/visual/approve`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsVisualReject(
  token: string,
  lifecycleId: number,
  itemId: number,
  comment: string,
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/visual/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment }),
  });
}

export function postContentOsEscalateHuman(
  token: string,
  lifecycleId: number,
  itemId: number,
  body?: { notes?: string },
): Promise<ContentOsItem> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/production/escalate-human`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export type ContentOsMetric = {
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

export type ContentOsIntelligence = {
  range: string;
  from_date: string;
  to_date: string;
  by_channel: Record<
    string,
    {
      published: number;
      avg_engagement?: number;
      impressions?: number;
      engagements?: number;
      clicks?: number;
      leads?: number;
      external_source?: string;
      external_metrics?: {
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
    }
  >;
  top_items: Array<{ item_id: number; title: string; score: number; channel: string }>;
  suggestions: string[];
  metrics_count: number;
  external_metrics?: {
    enabled: boolean;
    sources: string[];
    by_channel: Record<string, unknown>;
  };
  weekly_memo?: {
    title: string;
    body_vi: string;
    generated_at: string;
    job_id: number;
  } | null;
};

export type ContentOsApplySuggestionsResult = {
  ok: boolean;
  ideas_created: number;
  idea_ids: number[];
};

export function fetchContentOsIntelligence(
  token: string,
  lifecycleId: number,
  range = '30d',
): Promise<ContentOsIntelligence> {
  const q = new URLSearchParams({ range });
  return cmktFetch(token, lifecycleId, `/intelligence?${q.toString()}`);
}

export function postContentOsItemMetric(
  token: string,
  lifecycleId: number,
  itemId: number,
  body: {
    metric_date?: string;
    channel?: string;
    impressions?: number;
    engagements?: number;
    clicks?: number;
    leads?: number;
  },
): Promise<{ metric: ContentOsMetric }> {
  return cmktFetch(token, lifecycleId, `/items/${itemId}/metrics`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postContentOsTopicSuggestJob(
  token: string,
  lifecycleId: number,
  body?: { range?: string },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, '/jobs/topic-suggest', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsWeeklyMemoJob(
  token: string,
  lifecycleId: number,
  body?: { range?: string },
): Promise<ContentOsJob> {
  return cmktFetch(token, lifecycleId, '/jobs/intelligence/weekly-memo', {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export function postContentOsApplySuggestions(
  token: string,
  lifecycleId: number,
  body: {
    suggestion_indices?: number[];
    leader_confirm?: boolean;
  },
): Promise<ContentOsApplySuggestionsResult> {
  return cmktFetch(token, lifecycleId, '/intelligence/suggestions/apply', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postContentOsBulkApplySuggestions(
  token: string,
  lifecycleId: number,
  body: { suggestion_indices?: number[] },
): Promise<ContentOsApplySuggestionsResult> {
  return cmktFetch(token, lifecycleId, '/intelligence/suggestions/bulk-apply', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function itemNeedsVisualApproval(item: ContentOsItem): boolean {
  if (item.format === 'carousel' || item.format === 'video_script') return true;
  return item.brief_json?.needs_visual === true;
}

export function visualStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'not_needed':
      return 'Không cần visual';
    case 'ai_pending':
      return 'AI đang chạy';
    case 'ai_ready':
      return 'Chờ duyệt visual';
    case 'human_polish':
      return 'Design/Video đang sửa';
    case 'approved':
      return 'Visual đã duyệt';
    case 'rejected':
      return 'Visual bị từ chối';
    default:
      return status ?? '—';
  }
}
