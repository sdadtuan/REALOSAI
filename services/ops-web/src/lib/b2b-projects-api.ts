import { API_BASE, ApiError, parseJson } from './api';

export interface B2bProjectListItem {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface B2bProjectDetail extends B2bProjectListItem {
  owner_company_id: string;
  business_hours_json?: Record<string, unknown>;
  sla_json?: Record<string, unknown>;
  commission_json?: { first_touch_pct: number; closer_pct: number };
  ai_call_enabled?: boolean;
  manual_ingest_enabled?: boolean;
}

export interface B2bProjectPageRow {
  id: string;
  page_id: string;
  name?: string | null;
  token_ref?: string | null;
  active: boolean;
  forms?: Array<{ form_id: string; name?: string | null; active: boolean }>;
}

export interface B2bProjectChannelRow {
  id: string;
  channel_type: string;
  external_key: string;
  label?: string | null;
  config_json?: Record<string, unknown>;
  active: boolean;
}

export interface B2bProjectStaffRow {
  staff_id: number;
  assign_enabled: boolean;
  sales_level: string;
}

export function parseB2bProjectList(body: unknown): B2bProjectListItem[] {
  const items = Array.isArray(body) ? body : (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.map((row) => {
    const r = row as B2bProjectListItem;
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      status: String(r.status),
    };
  });
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

async function b2bFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
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
    throw new ApiError(body.error ?? body.message ?? 'B2B projects request failed', res.status);
  }
  return body;
}

export async function fetchB2bProjects(token: string, status?: string): Promise<B2bProjectListItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const body = await b2bFetch<unknown>(token, `/api/v1/b2b-projects${qs}`);
  return parseB2bProjectList(body);
}

export async function fetchB2bProject(token: string, id: string): Promise<B2bProjectDetail> {
  return b2bFetch(token, `/api/v1/b2b-projects/${encodeURIComponent(id)}`);
}

export async function createB2bProject(
  token: string,
  body: { code: string; name: string },
): Promise<B2bProjectDetail> {
  return b2bFetch(token, '/api/v1/b2b-projects', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function patchB2bProject(
  token: string,
  id: string,
  body: Partial<{
    name: string;
    status: string;
    ai_call_enabled: boolean;
    manual_ingest_enabled: boolean;
    sla_json: Record<string, unknown>;
    commission_json: { first_touch_pct: number; closer_pct: number };
  }>,
): Promise<B2bProjectDetail> {
  return b2bFetch(token, `/api/v1/b2b-projects/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function fetchB2bProjectPages(token: string, id: string): Promise<B2bProjectPageRow[]> {
  const body = await b2bFetch<{ pages?: B2bProjectPageRow[] } | B2bProjectPageRow[]>(
    token,
    `/api/v1/b2b-projects/${encodeURIComponent(id)}/pages`,
  );
  if (Array.isArray(body)) return body;
  return body.pages ?? [];
}

export async function fetchB2bProjectChannels(token: string, id: string): Promise<B2bProjectChannelRow[]> {
  const body = await b2bFetch<{ channels?: B2bProjectChannelRow[] } | B2bProjectChannelRow[]>(
    token,
    `/api/v1/b2b-projects/${encodeURIComponent(id)}/channels`,
  );
  if (Array.isArray(body)) return body;
  return body.channels ?? [];
}

export async function fetchB2bProjectStaff(token: string, id: string): Promise<B2bProjectStaffRow[]> {
  const body = await b2bFetch<{ staff?: B2bProjectStaffRow[] } | B2bProjectStaffRow[]>(
    token,
    `/api/v1/b2b-projects/${encodeURIComponent(id)}/staff`,
  );
  if (Array.isArray(body)) return body;
  return body.staff ?? [];
}

export async function replaceB2bProjectPages(
  token: string,
  id: string,
  pages: Array<{
    page_id: string;
    name?: string;
    token_ref?: string;
    active?: boolean;
    forms?: Array<{ form_id: string; name?: string; active?: boolean }>;
  }>,
): Promise<{ ok: true }> {
  return b2bFetch(token, `/api/v1/b2b-projects/${encodeURIComponent(id)}/pages`, {
    method: 'PUT',
    body: JSON.stringify({ pages }),
  });
}

export async function replaceB2bProjectChannels(
  token: string,
  id: string,
  channels: Array<{
    channel_type: 'zalo' | 'webform' | 'api';
    external_key: string;
    label?: string;
    active?: boolean;
  }>,
): Promise<{ ok: true }> {
  return b2bFetch(token, `/api/v1/b2b-projects/${encodeURIComponent(id)}/channels`, {
    method: 'PUT',
    body: JSON.stringify({ channels }),
  });
}

export async function replaceB2bProjectStaff(
  token: string,
  id: string,
  staff: Array<{ staff_id: number; assign_enabled?: boolean; sales_level?: string }>,
): Promise<{ ok: true }> {
  return b2bFetch(token, `/api/v1/b2b-projects/${encodeURIComponent(id)}/staff`, {
    method: 'PUT',
    body: JSON.stringify({ staff }),
  });
}
