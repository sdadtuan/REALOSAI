import { API_BASE, ApiError, parseJson } from './api';
import { hasCap, type StoredStaffUser } from './auth';

/** Same cap as API POST `/vd/projects/:id/jobs` (create or content write). */
export function canEnqueueVdJob(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'create') || hasCap(user, 'crm_content', 'write');
}

/** Same cap as API PUT/POST brief (project edit or content write). */
export function canEditVdBrief(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'edit') || hasCap(user, 'crm_content', 'write');
}

/** Same cap as API ideas/script/shots (script edit or project edit or content write). */
export function canEditVdScript(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.script', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API PUT bibles (bible edit or project edit or content write). */
export function canEditVdBible(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.bible', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API POST shot keyframe jobs (keyframe edit or project edit or content write). */
export function canEditVdKeyframe(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.keyframe', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API POST gate 1 approve/reject/override. */
export function canApproveGate1(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.gate1', 'approve') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API POST gate 2 approve/reject/override. */
export function canApproveGate2(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.gate2', 'approve') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API POST gate 3 approve/reject/override. */
export function canApproveGate3(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.gate3', 'approve') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API motion draft/final + take score. */
export function canEditVdMotion(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.motion', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API POST post/compose. */
export function canEditVdPost(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.post', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API gate 4 approve + review-links. */
export function canEditVdQc(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.qc', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API PUT budget (budget edit or project edit or content write). */
export function canEditVdBudget(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_vd.budget', 'edit') ||
    hasCap(user, 'crm_vd.project', 'edit') ||
    hasCap(user, 'crm_content', 'write')
  );
}

/** Same cap as API POST gate 4 approve/reject/override. */
export function canApproveGate4(user: StoredStaffUser | null): boolean {
  return canEditVdQc(user);
}

export function canApproveVdGate(user: StoredStaffUser | null, gateNo: number): boolean {
  if (gateNo === 1) return canApproveGate1(user);
  if (gateNo === 2) return canApproveGate2(user);
  if (gateNo === 3) return canApproveGate3(user);
  if (gateNo === 4) return canApproveGate4(user);
  return false;
}

export type VdProjectRow = {
  id: number;
  lifecycle_id: number;
  client_id: string | null;
  cmkt_item_id: number | null;
  title: string;
  stage: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CreateVdProjectBody = {
  lifecycle_id: number;
  cmkt_item_id: number;
  title?: string;
};

export function vdProjectCreatePath(): string {
  return '/api/v1/vd/projects';
}

export function vdProjectGetPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}`;
}

export function vdProjectJobsPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/jobs`;
}

export function vdProjectBriefPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/brief`;
}

export function vdProjectBriefReadyPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/brief/ready`;
}

export function vdProjectBriefInsightsPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/brief/insights`;
}

export function vdProjectIdeasPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/ideas`;
}

export function vdProjectIdeasGeneratePath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/ideas/generate`;
}

export function vdProjectIdeaSelectPath(projectId: number | string, ideaId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/ideas/${encodeURIComponent(String(ideaId))}/select`;
}

export function vdProjectScriptsPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/scripts`;
}

export function vdScriptShotsPath(id: number | string): string {
  return `/api/v1/vd/scripts/${encodeURIComponent(String(id))}/shots`;
}

export function vdPromptTemplatesPath(): string {
  return '/api/v1/vd/prompt-templates';
}

export function vdProjectBibleStylePath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/bibles/style`;
}

export function vdProjectBibleCharactersPath(id: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(id))}/bibles/characters`;
}

export function vdShotJobsPath(shotId: number | string): string {
  return `/api/v1/vd/shots/${encodeURIComponent(String(shotId))}/jobs`;
}

export function vdProjectShotsPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/shots`;
}

export function vdProjectKeyframesPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/keyframes`;
}

export function vdProjectGatePath(projectId: number | string, gateNo: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/gates/${encodeURIComponent(String(gateNo))}`;
}

export function vdProjectGateApprovePath(projectId: number | string, gateNo: number | string): string {
  return `${vdProjectGatePath(projectId, gateNo)}/approve`;
}

export function vdProjectGateRejectPath(projectId: number | string, gateNo: number | string): string {
  return `${vdProjectGatePath(projectId, gateNo)}/reject`;
}

export function vdProjectShotlistReadyPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/shotlist/ready`;
}

export function vdProjectStagePath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/stage`;
}

export function vdShotApproveKeyframePath(shotId: number | string): string {
  return `/api/v1/vd/shots/${encodeURIComponent(String(shotId))}/approve-keyframe`;
}

export function vdProjectRenderEstimatePath(
  projectId: number | string,
  shotId: number | string,
  jobType: string,
): string {
  const q = new URLSearchParams({
    shot_id: String(shotId),
    job_type: jobType,
  });
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/render-estimate?${q}`;
}

export function vdProjectTakesPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/takes`;
}

export function vdProjectBudgetPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/budget`;
}

export function vdProjectCostsPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/costs`;
}

export function vdProjectCostsExportPath(projectId: number | string, close = false): string {
  const base = `${vdProjectCostsPath(projectId)}/export.xlsx`;
  return close ? `${base}?close=1` : base;
}

export function vdProjectPostPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/post`;
}

export function vdProjectPostComposePath(projectId: number | string): string {
  return `${vdProjectPostPath(projectId)}/compose`;
}

export function vdProjectDeliveryPath(projectId: number | string): string {
  return `/api/v1/vd/projects/${encodeURIComponent(String(projectId))}/delivery`;
}

export function vdReviewLinksPath(): string {
  return '/api/v1/vd/review-links';
}

export function vdProductionReportPath(lifecycleId: number | string): string {
  return `/api/v1/vd/reports/production?lifecycle_id=${encodeURIComponent(String(lifecycleId))}`;
}

export function vdShotTakeScorePath(shotId: number | string): string {
  return `/api/v1/vd/shots/${encodeURIComponent(String(shotId))}/take-score`;
}

export function vdShotSelectTakePath(shotId: number | string): string {
  return `/api/v1/vd/shots/${encodeURIComponent(String(shotId))}/select-take`;
}

export function vdShotMotionDraftPath(shotId: number | string): string {
  return `/api/v1/vd/shots/${encodeURIComponent(String(shotId))}/motion/draft`;
}

export function vdShotMotionFinalPath(shotId: number | string): string {
  return `/api/v1/vd/shots/${encodeURIComponent(String(shotId))}/motion/final`;
}

export function vdProjectListPath(lifecycleId: number | string): string {
  return `/api/v1/vd/projects?lifecycle_id=${encodeURIComponent(String(lifecycleId))}`;
}

export function vdAdminProvidersPath(): string {
  return '/api/v1/vd/admin/providers';
}

export function vdAdminModelsPath(): string {
  return '/api/v1/vd/admin/models';
}

export type VdJobRow = {
  id: number;
  project_id: number;
  shot_id: number | null;
  queue: string;
  job_type: string;
  status: string;
  error_class: string | null;
  attempt: number;
  idempotency_key?: string;
  input_json?: Record<string, unknown>;
  output_json?: Record<string, unknown>;
  created_at?: string;
  updated_at: string;
};

export type EnqueueVdJobBody = {
  queue: string;
  job_type: string;
  payload?: Record<string, unknown>;
};

export type EnqueueVdJobResult = {
  id: number;
  status: string;
};

export type VdBriefRow = {
  project_id: number;
  body_json: Record<string, unknown>;
  stage: string;
};

export type VdBriefInsight = {
  id: number;
  title: string;
};

export type VdIdeaRow = {
  id: number;
  project_id: number;
  ordinal: number;
  summary: string;
  selected: boolean;
};

export type VdScriptRow = {
  id: number;
  project_id: number;
  version: number;
  markdown: string;
};

export type VdShotRow = {
  id: number;
  script_id: number;
  ordinal: number;
  status: string;
  duration_ms: number;
  camera: string;
  action: string;
  aspect: string;
  contains_human?: boolean;
  text_in_frame?: boolean;
  logo_in_ai_frame?: boolean;
  seed?: number | null;
  feasibility?: Array<{ id: string; ok: boolean }> | string | null;
};

export type VdPromptTemplateRow = {
  code: string;
  kind: string;
  body: string;
};

export type VdStyleBibleBody = {
  palette: string[];
  lens: string;
  lighting: string;
  refs: string[];
};

export type VdCharacterBibleItem = {
  name: string;
  lock_regions: string[];
  notes: string;
};

export type VdCharacterBibleBody = {
  items: VdCharacterBibleItem[];
};

export type VdKeyframeAssetRow = {
  id: number;
  project_id: number;
  job_id: number | null;
  kind: string;
  storage_key: string;
  url: string;
  sha256: string | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: string;
};

export type VdGateChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
};

export type VdGateView = {
  project_id: number;
  gate_no: number;
  status: string;
  stage: string;
  checklist: VdGateChecklistItem[];
};

export type VdRenderEstimate = {
  shot_id: number;
  job_type: string;
  credit_estimate: number;
  alert_threshold: number;
  needs_confirm: boolean;
};

export type VdTakeView = {
  asset_id: number;
  shot_id: number;
  url: string;
  sha256: string | null;
  duration_ms: number | null;
  verdict: string | null;
  artifact_json: Record<string, unknown>;
};

export type VdCostWarnings = {
  warn70: boolean;
  warn90: boolean;
  warn100: boolean;
};

export type VdBudgetView = {
  project_id: number;
  currency: string;
  limit_amount: number;
  buffer_factor: number;
  overshoot_factor: number;
  alert_threshold: number;
  updated_at: string;
  estimated_total: number;
  actual_total: number;
  warnings: VdCostWarnings;
};

export type VdCostLedgerRow = {
  id: number;
  project_id: number;
  job_id: number | null;
  kind: string;
  amount: number;
  vendor: string;
  created_at: string;
};

export type VdCostsView = {
  project_id: number;
  budget: VdBudgetView;
  items: VdCostLedgerRow[];
};

export type VdPostNodeView = {
  id: string;
  label: string;
  status: string;
  job_id: number | null;
};

export type VdPostPipelineView = {
  project_id: number;
  nodes: VdPostNodeView[];
  next_node: string;
  gate4_auto: { ok: boolean; blocked: boolean; reasons: string[] } | null;
};

export type VdDeliveryPackageView = {
  id: number;
  zip_storage_key: string;
  file_names_json: string[];
  meta_json: { contains_human: boolean; ai_disclosure: boolean };
  created_at: string;
};

export type VdDeliveryView = {
  project_id: number;
  gate4_status: string;
  qc_auto_pass: boolean;
  package: VdDeliveryPackageView | null;
};

export type VdReviewLinkView = {
  id: number;
  token: string;
  project_id: number;
  gate_no: number;
  asset_ids: number[];
  expires_at: string;
  watermark_label: string;
  portal_path: string;
};

export type VdProductionMetricRow = {
  metric: string;
  value: number;
  target: { label: string; direction: 'min' | 'max'; threshold: number };
  on_track: boolean;
};

export type VdProductionReport = {
  lifecycle_id: number;
  project_count: number;
  metrics: VdProductionMetricRow[];
};

export type AddVdShotBody = {
  duration_ms: number;
  camera: string;
  action: string;
  aspect?: string;
  contains_human?: boolean;
  text_in_frame?: boolean;
  logo_in_ai_frame?: boolean;
  seed?: number | null;
};

/** SC-04 form defaults: send explicit booleans so FR-R03 does not fail. */
export function sc04AddShotPayload(input: {
  duration_ms: number;
  camera: string;
  action: string;
  aspect?: string;
}): AddVdShotBody {
  return {
    duration_ms: input.duration_ms,
    camera: input.camera,
    action: input.action,
    aspect: input.aspect,
    contains_human: false,
    text_in_frame: false,
    logo_in_ai_frame: false,
  };
}

export type VdProviderRow = {
  id: number;
  code: string;
  label: string;
  created_at?: string;
};

export type VdModelRow = {
  id: number;
  provider: string;
  code: string;
  capability_json: Record<string, unknown> | string;
  created_at?: string;
};

/** SC-15: model_key is vd_models.code (ADR-L5-02). */
export function vdModelKey(row: Pick<VdModelRow, 'code'>): string {
  return row.code;
}

/** SC-15: verified_at from capability_json when object (or JSON string). */
export function vdModelVerifiedAt(
  capability_json: VdModelRow['capability_json'],
): string {
  let cap: unknown = capability_json;
  if (typeof cap === 'string') {
    const trimmed = cap.trim();
    if (!trimmed) return '';
    try {
      cap = JSON.parse(trimmed) as unknown;
    } catch {
      return '';
    }
  }
  if (!cap || typeof cap !== 'object' || Array.isArray(cap)) return '';
  const value = (cap as Record<string, unknown>).verified_at;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function vdFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: 'no-store' });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Video SOP request failed', res.status);
  }
  return body;
}

export async function createVdProject(token: string, body: CreateVdProjectBody): Promise<VdProjectRow> {
  return vdFetch<VdProjectRow>(token, vdProjectCreatePath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listVdProjects(token: string, lifecycleId: number): Promise<VdProjectRow[]> {
  const body = await vdFetch<VdProjectRow[] | { items?: VdProjectRow[] }>(
    token,
    vdProjectListPath(lifecycleId),
  );
  if (Array.isArray(body)) return body;
  return Array.isArray(body.items) ? body.items : [];
}

export async function getVdProject(token: string, id: number | string): Promise<VdProjectRow> {
  return vdFetch<VdProjectRow>(token, vdProjectGetPath(id));
}

export async function listVdJobs(token: string, projectId: number | string): Promise<VdJobRow[]> {
  const body = await vdFetch<VdJobRow[] | { items?: VdJobRow[] }>(
    token,
    vdProjectJobsPath(projectId),
  );
  return asItems(body);
}

export async function getVdBrief(token: string, id: number | string): Promise<VdBriefRow> {
  return vdFetch<VdBriefRow>(token, vdProjectBriefPath(id));
}

export async function saveVdBrief(
  token: string,
  id: number | string,
  body: Record<string, unknown>,
): Promise<VdBriefRow> {
  return vdFetch<VdBriefRow>(token, vdProjectBriefPath(id), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function markVdBriefReady(token: string, id: number | string): Promise<VdBriefRow> {
  return vdFetch<VdBriefRow>(token, vdProjectBriefReadyPath(id), { method: 'POST' });
}

export async function listVdBriefInsights(
  token: string,
  id: number | string,
): Promise<VdBriefInsight[]> {
  const body = await vdFetch<VdBriefInsight[] | { items?: VdBriefInsight[] }>(
    token,
    vdProjectBriefInsightsPath(id),
  );
  return asItems(body);
}

export async function listVdIdeas(token: string, projectId: number | string): Promise<VdIdeaRow[]> {
  const body = await vdFetch<VdIdeaRow[] | { items?: VdIdeaRow[] }>(
    token,
    vdProjectIdeasPath(projectId),
  );
  return asItems(body);
}

export async function generateVdIdeas(
  token: string,
  projectId: number | string,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdProjectIdeasGeneratePath(projectId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({}),
  });
}

export async function selectVdIdea(
  token: string,
  projectId: number | string,
  ideaId: number | string,
): Promise<VdIdeaRow[]> {
  const body = await vdFetch<VdIdeaRow[] | { items?: VdIdeaRow[] }>(
    token,
    vdProjectIdeaSelectPath(projectId, ideaId),
    { method: 'POST' },
  );
  return asItems(body);
}

export async function listVdScripts(token: string, projectId: number | string): Promise<VdScriptRow[]> {
  const body = await vdFetch<VdScriptRow[] | { items?: VdScriptRow[] }>(
    token,
    vdProjectScriptsPath(projectId),
  );
  return asItems(body);
}

export async function saveVdScript(
  token: string,
  projectId: number | string,
  markdown: string,
): Promise<VdScriptRow> {
  return vdFetch<VdScriptRow>(token, vdProjectScriptsPath(projectId), {
    method: 'PUT',
    body: JSON.stringify({ markdown }),
  });
}

export async function listVdShots(token: string, scriptId: number | string): Promise<VdShotRow[]> {
  const body = await vdFetch<VdShotRow[] | { items?: VdShotRow[] }>(token, vdScriptShotsPath(scriptId));
  return asItems(body);
}

export async function addVdShot(
  token: string,
  scriptId: number | string,
  body: AddVdShotBody,
): Promise<VdShotRow> {
  return vdFetch<VdShotRow>(token, vdScriptShotsPath(scriptId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listVdPromptTemplates(token: string): Promise<VdPromptTemplateRow[]> {
  const body = await vdFetch<VdPromptTemplateRow[] | { items?: VdPromptTemplateRow[] }>(
    token,
    vdPromptTemplatesPath(),
  );
  return asItems(body);
}

export async function getVdStyleBible(
  token: string,
  projectId: number | string,
): Promise<{ project_id: number; body_json: VdStyleBibleBody }> {
  return vdFetch(token, vdProjectBibleStylePath(projectId));
}

export async function saveVdStyleBible(
  token: string,
  projectId: number | string,
  body: VdStyleBibleBody,
): Promise<{ project_id: number; body_json: VdStyleBibleBody }> {
  return vdFetch(token, vdProjectBibleStylePath(projectId), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function getVdCharacterBible(
  token: string,
  projectId: number | string,
): Promise<{ project_id: number; body_json: VdCharacterBibleBody }> {
  return vdFetch(token, vdProjectBibleCharactersPath(projectId));
}

export async function saveVdCharacterBible(
  token: string,
  projectId: number | string,
  body: VdCharacterBibleBody,
): Promise<{ project_id: number; body_json: VdCharacterBibleBody }> {
  return vdFetch(token, vdProjectBibleCharactersPath(projectId), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function listVdProjectShots(token: string, projectId: number | string): Promise<VdShotRow[]> {
  const body = await vdFetch<VdShotRow[] | { items?: VdShotRow[] }>(token, vdProjectShotsPath(projectId));
  return asItems(body);
}

export async function listVdProjectKeyframes(
  token: string,
  projectId: number | string,
): Promise<VdKeyframeAssetRow[]> {
  const body = await vdFetch<VdKeyframeAssetRow[] | { items?: VdKeyframeAssetRow[] }>(
    token,
    vdProjectKeyframesPath(projectId),
  );
  return asItems(body);
}

export async function enqueueVdShotKeyframe(
  token: string,
  shotId: number | string,
  body: { prompt?: string; width?: number; height?: number; seed?: number; job_type?: string },
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdShotJobsPath(shotId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

export async function enqueueVdShotMotionDraft(
  token: string,
  shotId: number | string,
  body: Record<string, unknown>,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdShotJobsPath(shotId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ ...body, job_type: 'cine_motion_draft' }),
  });
}

export async function enqueueVdShotMotionFinal(
  token: string,
  shotId: number | string,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdShotJobsPath(shotId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ job_type: 'cine_motion_final' }),
  });
}

export async function getVdRenderEstimate(
  token: string,
  projectId: number | string,
  shotId: number | string,
  jobType: string,
): Promise<VdRenderEstimate> {
  return vdFetch<VdRenderEstimate>(
    token,
    vdProjectRenderEstimatePath(projectId, shotId, jobType),
  );
}

export async function listVdProjectTakes(
  token: string,
  projectId: number | string,
): Promise<VdTakeView[]> {
  const body = await vdFetch<VdTakeView[] | { items?: VdTakeView[] }>(
    token,
    vdProjectTakesPath(projectId),
  );
  return asItems(body);
}

export async function recordVdTakeScore(
  token: string,
  shotId: number | string,
  body: { asset_id: number; verdict: 'passed' | 'failed'; artifact_json?: Record<string, unknown> },
): Promise<unknown> {
  return vdFetch(token, vdShotTakeScorePath(shotId), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function selectVdTake(
  token: string,
  shotId: number | string,
  assetId: number,
): Promise<VdShotRow> {
  return vdFetch<VdShotRow>(token, vdShotSelectTakePath(shotId), {
    method: 'POST',
    body: JSON.stringify({ asset_id: assetId }),
  });
}

export async function getVdBudget(
  token: string,
  projectId: number | string,
): Promise<VdBudgetView> {
  return vdFetch<VdBudgetView>(token, vdProjectBudgetPath(projectId));
}

export async function saveVdBudget(
  token: string,
  projectId: number | string,
  body: {
    limit_amount?: number;
    buffer_factor?: number;
    overshoot_factor?: number;
    alert_threshold?: number;
    currency?: string;
  },
): Promise<VdBudgetView> {
  return vdFetch<VdBudgetView>(token, vdProjectBudgetPath(projectId), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function listVdCosts(
  token: string,
  projectId: number | string,
): Promise<VdCostsView> {
  return vdFetch<VdCostsView>(token, vdProjectCostsPath(projectId));
}

export async function exportVdCostsXlsx(
  token: string,
  projectId: number | string,
  accountingClose: boolean,
): Promise<Blob> {
  const path = vdProjectCostsExportPath(projectId, accountingClose);
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(body.error ?? body.message ?? 'Export failed', res.status);
  }
  return res.blob();
}

export async function getVdPostPipeline(
  token: string,
  projectId: number | string,
): Promise<VdPostPipelineView> {
  return vdFetch<VdPostPipelineView>(token, vdProjectPostPath(projectId));
}

export async function enqueueVdPostCompose(
  token: string,
  projectId: number | string,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdProjectPostComposePath(projectId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({}),
  });
}

export async function getVdDelivery(
  token: string,
  projectId: number | string,
): Promise<VdDeliveryView> {
  return vdFetch<VdDeliveryView>(token, vdProjectDeliveryPath(projectId));
}

export async function createVdDeliveryPackage(
  token: string,
  projectId: number | string,
): Promise<{ package: VdDeliveryPackageView }> {
  return vdFetch<{ package: VdDeliveryPackageView }>(token, vdProjectDeliveryPath(projectId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createVdReviewLink(
  token: string,
  body: {
    project_id: number;
    gate_no: number;
    asset_ids: number[];
    ttl_days?: number;
    watermark_label?: string;
  },
): Promise<VdReviewLinkView> {
  return vdFetch<VdReviewLinkView>(token, vdReviewLinksPath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getVdProductionReport(
  token: string,
  lifecycleId: number | string,
): Promise<VdProductionReport> {
  return vdFetch<VdProductionReport>(token, vdProductionReportPath(lifecycleId));
}

export async function enqueueVdJob(
  token: string,
  projectId: number | string,
  body: EnqueueVdJobBody,
  idempotencyKey: string,
): Promise<EnqueueVdJobResult> {
  return vdFetch<EnqueueVdJobResult>(token, vdProjectJobsPath(projectId), {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(body),
  });
}

function asItems<T>(body: T[] | { items?: T[] }): T[] {
  if (Array.isArray(body)) return body;
  return Array.isArray(body.items) ? body.items : [];
}

export async function listVdAdminProviders(token: string): Promise<VdProviderRow[]> {
  const body = await vdFetch<VdProviderRow[] | { items?: VdProviderRow[] }>(
    token,
    vdAdminProvidersPath(),
  );
  return asItems(body);
}

export async function createVdAdminProvider(
  token: string,
  body: { code: string; label: string },
): Promise<VdProviderRow> {
  return vdFetch<VdProviderRow>(token, vdAdminProvidersPath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function listVdAdminModels(token: string): Promise<VdModelRow[]> {
  const body = await vdFetch<VdModelRow[] | { items?: VdModelRow[] }>(token, vdAdminModelsPath());
  return asItems(body);
}

export async function createVdAdminModel(
  token: string,
  body: { provider_code: string; code: string; capability_json: Record<string, unknown> | string },
): Promise<VdModelRow> {
  return vdFetch<VdModelRow>(token, vdAdminModelsPath(), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getVdGate(
  token: string,
  projectId: number | string,
  gateNo: number,
): Promise<VdGateView> {
  return vdFetch<VdGateView>(token, vdProjectGatePath(projectId, gateNo));
}

export async function approveVdGate(
  token: string,
  projectId: number | string,
  gateNo: number,
  body: { override?: boolean; override_reason?: string } = {},
): Promise<VdGateView> {
  return vdFetch<VdGateView>(token, vdProjectGateApprovePath(projectId, gateNo), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function rejectVdGate(
  token: string,
  projectId: number | string,
  gateNo: number,
  body: { reason: string },
): Promise<VdGateView> {
  return vdFetch<VdGateView>(token, vdProjectGateRejectPath(projectId, gateNo), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function markVdShotlistReady(
  token: string,
  projectId: number | string,
): Promise<VdProjectRow> {
  return vdFetch<VdProjectRow>(token, vdProjectShotlistReadyPath(projectId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function advanceVdStage(
  token: string,
  projectId: number | string,
  stage: string,
): Promise<VdProjectRow> {
  return vdFetch<VdProjectRow>(token, vdProjectStagePath(projectId), {
    method: 'POST',
    body: JSON.stringify({ stage }),
  });
}

export async function approveVdShotKeyframe(
  token: string,
  shotId: number | string,
): Promise<VdShotRow> {
  return vdFetch<VdShotRow>(token, vdShotApproveKeyframePath(shotId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export const VIDEO_SOP_API = {
  createProject: createVdProject,
  listProjects: listVdProjects,
  getProject: getVdProject,
  getBrief: getVdBrief,
  saveBrief: saveVdBrief,
  markBriefReady: markVdBriefReady,
  listBriefInsights: listVdBriefInsights,
  listIdeas: listVdIdeas,
  generateIdeas: generateVdIdeas,
  selectIdea: selectVdIdea,
  listScripts: listVdScripts,
  saveScript: saveVdScript,
  listShots: listVdShots,
  addShot: addVdShot,
  getStyleBible: getVdStyleBible,
  saveStyleBible: saveVdStyleBible,
  getCharacterBible: getVdCharacterBible,
  saveCharacterBible: saveVdCharacterBible,
  listProjectShots: listVdProjectShots,
  listProjectKeyframes: listVdProjectKeyframes,
  enqueueShotKeyframe: enqueueVdShotKeyframe,
  enqueueShotMotionDraft: enqueueVdShotMotionDraft,
  enqueueShotMotionFinal: enqueueVdShotMotionFinal,
  getRenderEstimate: getVdRenderEstimate,
  listProjectTakes: listVdProjectTakes,
  recordTakeScore: recordVdTakeScore,
  selectTake: selectVdTake,
  getBudget: getVdBudget,
  saveBudget: saveVdBudget,
  listCosts: listVdCosts,
  exportCostsXlsx: exportVdCostsXlsx,
  getPostPipeline: getVdPostPipeline,
  enqueuePostCompose: enqueueVdPostCompose,
  getDelivery: getVdDelivery,
  createDeliveryPackage: createVdDeliveryPackage,
  createReviewLink: createVdReviewLink,
  getProductionReport: getVdProductionReport,
  listPromptTemplates: listVdPromptTemplates,
  listJobs: listVdJobs,
  enqueueJob: enqueueVdJob,
  listAdminProviders: listVdAdminProviders,
  createAdminProvider: createVdAdminProvider,
  listAdminModels: listVdAdminModels,
  createAdminModel: createVdAdminModel,
  modelKey: vdModelKey,
  modelVerifiedAt: vdModelVerifiedAt,
  getGate: getVdGate,
  approveGate: approveVdGate,
  rejectGate: rejectVdGate,
  markShotlistReady: markVdShotlistReady,
  advanceStage: advanceVdStage,
  approveShotKeyframe: approveVdShotKeyframe,
};
