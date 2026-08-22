import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export class SpcApiError extends ApiError {
  constructor(message: string, status: number) {
    super(message, status);
    this.name = 'SpcApiError';
  }
}

async function spcFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new SpcApiError(body || res.statusText, res.status);
  }
  return parseJson<T>(res);
}

export type SpcPortfolioItem = {
  dv_code: string;
  name_vi: string;
  department: string;
  readiness: string;
  service_type: string;
  offer_count: number;
  published_count: number;
  draft_count: number;
};

export type SpcPricingModel = Record<string, unknown>;

export type SpcOfferRow = {
  sku_code: string;
  dv_code: string;
  tier: 'CB' | 'TC' | 'CS';
  label_vi: string;
  scope_summary_vi: string;
  pricing_model: SpcPricingModel;
  duration_hint_vi: string;
  status: 'draft' | 'published' | 'archived';
  published_version: number;
  draft_pricing_model?: SpcPricingModel | null;
  draft_scope_summary_vi?: string | null;
  has_pending_draft?: boolean;
  updated_at: string;
};

export type SpcFamilyDetail = {
  dv_code: string;
  name_vi: string;
  department: string;
  role_vi: string;
  service_type: string;
  description_vi: string;
  readiness: string;
  offers: SpcOfferRow[];
  phase_count: number;
  kpi_count: number;
  component_count?: number;
};

export type SpcComponentRow = {
  component_code: string;
  dv_code: string;
  name_vi: string;
  description_vi: string;
  deliverable_vi: string;
  pricing_model: SpcPricingModel;
  unit: string;
  sort_order: number;
  active: boolean;
  status?: 'draft' | 'published' | 'archived';
  published_version?: number;
  draft_pricing_model?: SpcPricingModel | null;
  draft_name_vi?: string | null;
  draft_description_vi?: string | null;
  draft_deliverable_vi?: string | null;
  has_pending_draft?: boolean;
};

export type SpcBundleItemRow = {
  sku_code: string;
  component_code: string;
  included: boolean;
  qty: number;
  price_override_vnd: number | null;
  sort_order: number;
  name_vi?: string;
  pricing_model?: SpcPricingModel;
};

export type SpcHubStats = {
  family_count: number;
  published_skus: number;
  draft_offers: number;
  pilot_dv: string[];
};

export type SpcPublishLogItem = {
  id: number;
  entity_type: string;
  entity_key: string;
  action: string;
  from_version: number | null;
  to_version: number | null;
  actor_email: string;
  created_at: string;
};

export async function fetchSpcHub(token: string) {
  return spcFetch<SpcHubStats>(token, '/api/v1/admin/spc/hub');
}

export async function fetchSpcPortfolio(token: string) {
  return spcFetch<{ items: SpcPortfolioItem[] }>(token, '/api/v1/admin/spc/families');
}

export async function fetchSpcFamily(token: string, dvCode: string) {
  return spcFetch<SpcFamilyDetail>(token, `/api/v1/admin/spc/families/${encodeURIComponent(dvCode)}`);
}

export async function patchSpcOffer(
  token: string,
  skuCode: string,
  body: {
    label_vi?: string;
    scope_summary_vi?: string;
    pricing_model?: SpcPricingModel;
    duration_hint_vi?: string;
  },
) {
  return spcFetch<SpcOfferRow>(token, `/api/v1/admin/spc/offers/${encodeURIComponent(skuCode)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function publishSpcEntity(token: string, entity: 'offer' | 'component', key: string) {
  return spcFetch<{ published: SpcOfferRow | SpcComponentRow }>(token, '/api/v1/admin/spc/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entity, key }),
  });
}

export type SpcBundlePriceAudit = {
  sku_code: string;
  offer_min_vnd: number;
  offer_max_vnd: number;
  components_min_sum_vnd: number;
  components_max_sum_vnd: number;
  delta_min_vnd: number;
  delta_max_vnd: number;
  status: 'ok' | 'warn_below_floor' | 'warn_above_ceiling' | 'no_components';
  message_vi: string;
  items: Array<{
    component_code: string;
    name_vi: string;
    qty: number;
    min_vnd: number;
    max_vnd: number;
  }>;
};

export async function fetchSpcOfferBundleAudit(token: string, skuCode: string) {
  return spcFetch<SpcBundlePriceAudit>(
    token,
    `/api/v1/admin/spc/offers/${encodeURIComponent(skuCode)}/bundle-audit`,
  );
}

export async function fetchSpcPublishLog(token: string) {
  return spcFetch<{ draft_count: number; items: SpcPublishLogItem[] }>(
    token,
    '/api/v1/admin/spc/publish-log?limit=30',
  );
}

export type SpcProcessPhaseRow = {
  phase_code: string;
  dv_code: string;
  sku_code: string | null;
  week_label_vi: string;
  ptt_work_vi: string;
  deliverable_vi: string;
  client_action_vi: string;
  tasks_json: unknown[];
  sort_order: number;
  active: boolean;
};

export type SpcOfferProcessResponse = {
  sku_code: string;
  dv_code: string;
  phase_count: number;
  phases: SpcProcessPhaseRow[];
};

export async function fetchSpcOfferProcess(token: string, skuCode: string) {
  return spcFetch<SpcOfferProcessResponse>(
    token,
    `/api/spc/offers/${encodeURIComponent(skuCode)}/process`,
  );
}

export async function fetchSpcProcessLibrary(token: string, dvCode?: string) {
  const qs = dvCode ? `?dv_code=${encodeURIComponent(dvCode)}` : '';
  return spcFetch<{ count: number; items: SpcProcessPhaseRow[] }>(
    token,
    `/api/v1/admin/spc/process${qs}`,
  );
}

export async function fetchSpcComponents(token: string, dvCode: string) {
  return spcFetch<{ count: number; items: SpcComponentRow[] }>(
    token,
    `/api/v1/admin/spc/components?dv_code=${encodeURIComponent(dvCode)}`,
  );
}

export async function createSpcComponent(
  token: string,
  body: {
    dv_code: string;
    name_vi: string;
    description_vi?: string;
    deliverable_vi?: string;
    pricing_model?: SpcPricingModel;
    sort_order?: number;
  },
) {
  return spcFetch<SpcComponentRow>(token, '/api/v1/admin/spc/components', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function patchSpcComponent(
  token: string,
  componentCode: string,
  body: Partial<{
    name_vi: string;
    description_vi: string;
    deliverable_vi: string;
    pricing_model: SpcPricingModel;
    sort_order: number;
    active: boolean;
  }>,
) {
  return spcFetch<SpcComponentRow>(token, `/api/v1/admin/spc/components/${encodeURIComponent(componentCode)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function archiveSpcComponent(token: string, componentCode: string) {
  return spcFetch<SpcComponentRow>(
    token,
    `/api/v1/admin/spc/components/${encodeURIComponent(componentCode)}/archive`,
    { method: 'POST' },
  );
}

export async function fetchSpcOfferBundle(token: string, skuCode: string) {
  return spcFetch<{ sku_code: string; dv_code: string; items: SpcBundleItemRow[] }>(
    token,
    `/api/v1/admin/spc/offers/${encodeURIComponent(skuCode)}/bundle`,
  );
}

export async function putSpcOfferBundle(
  token: string,
  skuCode: string,
  items: Array<{ component_code: string; included?: boolean; qty?: number }>,
) {
  return spcFetch<{ sku_code: string; items: SpcBundleItemRow[] }>(
    token,
    `/api/v1/admin/spc/offers/${encodeURIComponent(skuCode)}/bundle`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    },
  );
}

export type SpcFamilyTreeBundleComponent = {
  component_code: string;
  name_vi: string;
  included: boolean;
  qty: number;
  pricing_model: SpcPricingModel;
};

export type SpcFamilyTreeOffer = {
  sku_code: string;
  tier: string;
  label_vi: string;
  scope_summary_vi: string;
  pricing_model: SpcPricingModel;
  bundle: SpcFamilyTreeBundleComponent[];
};

export type SpcFamilyTreeResponse = {
  dv_code: string;
  name_vi: string;
  source_doc?: string;
  component_count: number;
  components: SpcComponentRow[];
  offers: SpcFamilyTreeOffer[];
};

export async function fetchSpcFamilyTree(token: string, dvCode: string) {
  return spcFetch<SpcFamilyTreeResponse>(
    token,
    `/api/v1/admin/spc/families/${encodeURIComponent(dvCode)}/tree`,
  );
}

export async function importSpcDocBundle(token: string, dvCode?: string) {
  const qs = dvCode ? `?dv_code=${encodeURIComponent(dvCode)}` : '';
  return spcFetch<{
    source_doc?: string;
    imported: number;
    results: Array<{ dv_code: string; components: number; bundle_items: number; skus: string[] }>;
  }>(token, `/api/v1/admin/spc/import/doc-bundle${qs}`, { method: 'POST' });
}

export function formatPricingModel(model: SpcPricingModel | undefined): string {
  if (!model?.type) return '—';
  switch (model.type) {
    case 'setup_plus_retainer':
      return `Setup ${Number(model.setup_min_vnd ?? 0).toLocaleString('vi-VN')} – ${Number(model.setup_max_vnd ?? 0).toLocaleString('vi-VN')} ₫ · Tháng ${Number(model.monthly_min_vnd ?? 0).toLocaleString('vi-VN')} – ${Number(model.monthly_max_vnd ?? 0).toLocaleString('vi-VN')} ₫`;
    case 'retainer':
      return `Tháng ${Number(model.monthly_min_vnd ?? 0).toLocaleString('vi-VN')} – ${Number(model.monthly_max_vnd ?? 0).toLocaleString('vi-VN')} ₫`;
    case 'one_time':
      return `${Number(model.min_vnd ?? 0).toLocaleString('vi-VN')} – ${Number(model.max_vnd ?? 0).toLocaleString('vi-VN')} ₫`;
    default:
      return String(model.type);
  }
}

export function pricingModelFields(model: SpcPricingModel): Array<{ key: string; label: string; value: number }> {
  const type = String(model.type ?? '');
  if (type === 'setup_plus_retainer') {
    return [
      { key: 'setup_min_vnd', label: 'Setup min (₫)', value: Number(model.setup_min_vnd ?? 0) },
      { key: 'setup_max_vnd', label: 'Setup max (₫)', value: Number(model.setup_max_vnd ?? 0) },
      { key: 'monthly_min_vnd', label: 'Tháng min (₫)', value: Number(model.monthly_min_vnd ?? 0) },
      { key: 'monthly_max_vnd', label: 'Tháng max (₫)', value: Number(model.monthly_max_vnd ?? 0) },
    ];
  }
  if (type === 'retainer') {
    return [
      { key: 'monthly_min_vnd', label: 'Tháng min (₫)', value: Number(model.monthly_min_vnd ?? 0) },
      { key: 'monthly_max_vnd', label: 'Tháng max (₫)', value: Number(model.monthly_max_vnd ?? 0) },
    ];
  }
  if (type === 'one_time') {
    return [
      { key: 'min_vnd', label: 'Min (₫)', value: Number(model.min_vnd ?? 0) },
      { key: 'max_vnd', label: 'Max (₫)', value: Number(model.max_vnd ?? 0) },
    ];
  }
  return [];
}

export function applyPricingField(model: SpcPricingModel, key: string, value: number): SpcPricingModel {
  return { ...model, [key]: value };
}
