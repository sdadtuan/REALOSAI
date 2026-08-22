import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function cmsFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(authHeaders(token) as Record<string, string>),
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  };
  if (init?.body && !headers['Content-Type'] && typeof init.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${API_BASE}/api/v1/gtm/cms${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  const body = await parseJson<T & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'CMS API failed', res.status);
  }
  return body;
}

export type CmsLocale = 'vi' | 'en';
export type CmsArticleCategory = 'insight' | 'nganh' | 'huong-dan';
export type CmsArticleStatus = 'draft' | 'published' | 'archived';
export type CmsEventStatus = 'draft' | 'published' | 'cancelled' | 'archived';
export type CmsEventKind = 'webinar' | 'workshop' | 'meetup' | 'conference' | 'other';
export type CmsLocationType = 'online' | 'offline' | 'hybrid';
export type CmsCtaType = 'demo' | 'url';
export type CmsMediaStatus = 'active' | 'archived';

export const CMS_SLOT_KEYS = [
  'home.hero',
  'home.module.crm',
  'home.module.ads',
  'home.module.portal',
  'home.module.ai',
  'product.crm',
  'product.ads',
  'product.portal',
  'product.ai',
  'solution.bds',
  'solution.agency',
  'solution.fnb',
] as const;

export type CmsSlotKey = (typeof CMS_SLOT_KEYS)[number];

export type CmsMediaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  storage_key: string;
  public_url: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  alt_vi: string | null;
  alt_en: string | null;
  credit: string | null;
  status: CmsMediaStatus;
  uploaded_by: string;
};

export type CmsArticleRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  category: CmsArticleCategory;
  status: CmsArticleStatus;
  published_at: string | null;
  cover_media_id: string | null;
  title_vi: string;
  title_en: string | null;
  dek_vi: string;
  dek_en: string | null;
  body_vi: string;
  body_en: string | null;
  seo_title_vi: string | null;
  seo_title_en: string | null;
  seo_desc_vi: string | null;
  seo_desc_en: string | null;
  featured_home: boolean;
  created_by: string;
  updated_by: string;
};

export type CmsEventRow = {
  id: string;
  created_at: string;
  updated_at: string;
  slug: string;
  kind: CmsEventKind;
  status: CmsEventStatus;
  start_at: string;
  end_at: string;
  timezone: string;
  location_type: CmsLocationType;
  location_vi: string | null;
  location_en: string | null;
  title_vi: string;
  title_en: string | null;
  dek_vi: string;
  dek_en: string | null;
  body_vi: string;
  body_en: string | null;
  cover_media_id: string | null;
  cta_type: CmsCtaType;
  cta_url: string | null;
  published_at: string | null;
  created_by: string;
  updated_by: string;
};

export type CmsSlotRow = {
  slot_key: string;
  media_id: string;
  caption_vi: string | null;
  caption_en: string | null;
  updated_at: string;
  updated_by: string;
};

export type CreateArticleBody = {
  slug: string;
  category: CmsArticleCategory;
  title_vi: string;
  title_en?: string | null;
  dek_vi: string;
  dek_en?: string | null;
  body_vi: string;
  body_en?: string | null;
  cover_media_id?: string | null;
  seo_title_vi?: string | null;
  seo_title_en?: string | null;
  seo_desc_vi?: string | null;
  seo_desc_en?: string | null;
  featured_home?: boolean;
};

export type PatchArticleBody = Partial<CreateArticleBody>;

export type CreateEventBody = {
  slug: string;
  kind: CmsEventKind;
  start_at: string;
  end_at: string;
  timezone?: string;
  location_type: CmsLocationType;
  location_vi?: string | null;
  location_en?: string | null;
  title_vi: string;
  title_en?: string | null;
  dek_vi: string;
  dek_en?: string | null;
  body_vi: string;
  body_en?: string | null;
  cover_media_id?: string | null;
  cta_type: CmsCtaType;
  cta_url?: string | null;
};

export type PatchEventBody = Partial<CreateEventBody & { status: CmsEventStatus }>;

export type PatchMediaBody = {
  alt_vi?: string | null;
  alt_en?: string | null;
  credit?: string | null;
  status?: CmsMediaStatus;
  hard?: boolean;
};

export type PutSlotBody = {
  media_id: string;
  caption_vi?: string | null;
  caption_en?: string | null;
};

export type PublishBody = {
  locales?: CmsLocale[];
};

export function buildPublishBody(opts: { publishEn: boolean }): PublishBody {
  return opts.publishEn ? { locales: ['vi', 'en'] } : { locales: ['vi'] };
}

export async function fetchCmsMedia(
  token: string,
  params?: { limit?: number; offset?: number },
): Promise<CmsMediaRow[]> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return cmsFetch(token, `/media${suffix}`);
}

export async function uploadCmsMedia(
  token: string,
  file: File,
  meta?: { alt_vi?: string; alt_en?: string; credit?: string },
): Promise<CmsMediaRow> {
  const form = new FormData();
  form.append('file', file);
  if (meta?.alt_vi) form.append('alt_vi', meta.alt_vi);
  if (meta?.alt_en) form.append('alt_en', meta.alt_en);
  if (meta?.credit) form.append('credit', meta.credit);

  const res = await fetch(`${API_BASE}/api/v1/gtm/cms/media`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
    cache: 'no-store',
  });
  const body = await parseJson<CmsMediaRow & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Upload failed', res.status);
  }
  return body;
}

export async function patchCmsMedia(
  token: string,
  id: string,
  body: PatchMediaBody,
): Promise<CmsMediaRow> {
  return cmsFetch(token, `/media/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function fetchCmsArticles(
  token: string,
  params?: { status?: CmsArticleStatus; category?: CmsArticleCategory; limit?: number; offset?: number },
): Promise<{ rows: CmsArticleRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.category) qs.set('category', params.category);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return cmsFetch(token, `/articles${suffix}`);
}

export async function createCmsArticle(token: string, body: CreateArticleBody): Promise<CmsArticleRow> {
  return cmsFetch(token, '/articles', { method: 'POST', body: JSON.stringify(body) });
}

export async function patchCmsArticle(
  token: string,
  id: string,
  body: PatchArticleBody,
): Promise<CmsArticleRow> {
  return cmsFetch(token, `/articles/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function publishCmsArticle(
  token: string,
  id: string,
  body?: PublishBody,
): Promise<CmsArticleRow> {
  return cmsFetch(token, `/articles/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(body ?? buildPublishBody({ publishEn: false })),
  });
}

export async function unpublishCmsArticle(token: string, id: string): Promise<CmsArticleRow> {
  return cmsFetch(token, `/articles/${id}/unpublish`, { method: 'POST', body: '{}' });
}

export async function fetchCmsEvents(
  token: string,
  params?: { status?: CmsEventStatus; limit?: number; offset?: number },
): Promise<{ rows: CmsEventRow[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return cmsFetch(token, `/events${suffix}`);
}

export async function createCmsEvent(token: string, body: CreateEventBody): Promise<CmsEventRow> {
  return cmsFetch(token, '/events', { method: 'POST', body: JSON.stringify(body) });
}

export async function patchCmsEvent(
  token: string,
  id: string,
  body: PatchEventBody,
): Promise<CmsEventRow> {
  return cmsFetch(token, `/events/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function publishCmsEvent(
  token: string,
  id: string,
  body?: PublishBody,
): Promise<CmsEventRow> {
  return cmsFetch(token, `/events/${id}/publish`, {
    method: 'POST',
    body: JSON.stringify(body ?? buildPublishBody({ publishEn: false })),
  });
}

export async function unpublishCmsEvent(token: string, id: string): Promise<CmsEventRow> {
  return cmsFetch(token, `/events/${id}/unpublish`, { method: 'POST', body: '{}' });
}

export async function fetchCmsSlot(token: string, slotKey: string): Promise<CmsSlotRow | null> {
  const res = await fetch(`${API_BASE}/api/v1/gtm/cms/slots/${encodeURIComponent(slotKey)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  const body = await parseJson<CmsSlotRow & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? body.message ?? 'Slot fetch failed', res.status);
  }
  return body;
}

export async function putCmsSlot(
  token: string,
  slotKey: string,
  body: PutSlotBody,
): Promise<CmsSlotRow> {
  return cmsFetch(token, `/slots/${encodeURIComponent(slotKey)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
