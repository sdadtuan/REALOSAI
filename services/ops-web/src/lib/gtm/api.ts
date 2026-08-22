import { API_BASE, ApiError, parseJson } from '@/lib/api';
import type { GtmSlaTone } from './caps';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function gtmFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(body.error ?? body.message ?? 'GTM API failed', res.status);
  }
  return body;
}

export type GtmStatus =
  | 'new'
  | 'qualified'
  | 'disqualified'
  | 'demo_booked'
  | 'sandbox_granted'
  | 'won'
  | 'lost';

export type GtmIndustry = 'bds' | 'agency' | 'fnb' | 'education' | 'pharma' | 'other';
export type GtmSkuInterest = 'mkt' | 'ind' | 'agy';
export type GtmLocale = 'vi' | 'en';
export type GtmMarketCountry = 'th' | 'id' | 'ph' | 'sg';

export type GtmDemoRequestRow = {
  id: string;
  created_at: string;
  updated_at: string;
  locale: GtmLocale;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  industry: GtmIndustry;
  sku_interest: GtmSkuInterest;
  company_size: string | null;
  message: string | null;
  landing_path: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  status: GtmStatus;
  status_note: string | null;
  owner_user_id: string | null;
  lead_id: string | null;
  sandbox_expires_at: string | null;
  sandbox_user_id: string | null;
  ip_hash: string;
  market_country: string | null;
  sla_tone: GtmSlaTone;
  sla_deadline_local: string | null;
  sla_timezone_label: string | null;
};

export type GtmDemoListResponse = {
  rows: GtmDemoRequestRow[];
  total: number;
  limit: number;
  offset: number;
};

export type GtmDemoListParams = {
  status?: GtmStatus;
  industry?: GtmIndustry;
  locale?: GtmLocale;
  market_country?: GtmMarketCountry;
  owner_user_id?: string;
  limit?: number;
  offset?: number;
};

export type PatchGtmDemoBody = {
  status?: GtmStatus;
  status_note?: string | null;
  owner_user_id?: string | null;
};

export async function fetchGtmDemoRequests(
  token: string,
  params?: GtmDemoListParams,
): Promise<GtmDemoListResponse> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.industry) qs.set('industry', params.industry);
  if (params?.locale) qs.set('locale', params.locale);
  if (params?.market_country) qs.set('market_country', params.market_country);
  if (params?.owner_user_id) qs.set('owner_user_id', params.owner_user_id);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return gtmFetch(token, `/api/v1/gtm/demo-requests${suffix}`);
}

export async function patchGtmDemoRequest(
  token: string,
  id: string,
  body: PatchGtmDemoBody,
): Promise<GtmDemoRequestRow> {
  return gtmFetch(token, `/api/v1/gtm/demo-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function grantGtmSandbox(token: string, id: string): Promise<GtmDemoRequestRow> {
  return gtmFetch(token, `/api/v1/gtm/demo-requests/${id}/sandbox`, { method: 'POST' });
}

export async function exportGtmDemoRequests(
  token: string,
  params?: GtmDemoListParams,
): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.industry) qs.set('industry', params.industry);
  if (params?.locale) qs.set('locale', params.locale);
  if (params?.market_country) qs.set('market_country', params.market_country);
  if (params?.owner_user_id) qs.set('owner_user_id', params.owner_user_id);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/gtm/demo-requests/export${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'Export failed', res.status);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `gtm-demo-requests-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type GtmImportResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
};

export async function importGtmDemoRequests(token: string, file: File): Promise<GtmImportResult> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/gtm/demo-requests/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
    cache: 'no-store',
  });
  const body = await parseJson<GtmImportResult & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Import failed', res.status);
  }
  return body;
}

export async function downloadGtmProposalPdf(token: string, id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/gtm/demo-requests/${id}/proposal.pdf`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await parseJson<{ error?: string; message?: string }>(res);
    throw new ApiError(body.error ?? body.message ?? 'PDF failed', res.status);
  }
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = cd.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `pttcrm-proposal-${id}.pdf`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const GTM_MARKET_LABELS: Record<GtmMarketCountry, string> = {
  th: 'Thailand',
  id: 'Indonesia',
  ph: 'Philippines',
  sg: 'Singapore',
};

export const GTM_STATUS_LABELS: Record<GtmStatus, string> = {
  new: 'Mới',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  demo_booked: 'Demo booked',
  sandbox_granted: 'Sandbox',
  won: 'Won',
  lost: 'Lost',
};

export const GTM_INDUSTRY_LABELS: Record<GtmIndustry, string> = {
  bds: 'BĐS',
  agency: 'Agency',
  fnb: 'F&B',
  education: 'Giáo dục',
  pharma: 'Pharma',
  other: 'Khác',
};

export const GTM_SKU_LABELS: Record<GtmSkuInterest, string> = {
  mkt: 'Marketing',
  ind: 'Industrial',
  agy: 'Agency',
};

export const GTM_NEXT_STATUSES: Record<GtmStatus, GtmStatus[]> = {
  new: ['qualified', 'disqualified'],
  qualified: ['demo_booked', 'disqualified'],
  demo_booked: ['won', 'lost', 'sandbox_granted'],
  sandbox_granted: ['won', 'lost'],
  disqualified: [],
  won: [],
  lost: [],
};
