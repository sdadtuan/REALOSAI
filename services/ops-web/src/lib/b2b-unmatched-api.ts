import { API_BASE, ApiError, parseJson } from './api';

export interface B2bUnmatchedRow {
  id: string;
  channel: string;
  project_slug: string | null;
  external_key: string;
  created_at: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchB2bUnmatched(
  token: string,
  opts?: { limit?: number; since?: string },
): Promise<B2bUnmatchedRow[]> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  if (opts?.since) params.set('since', opts.since);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/b2b-unmatched${qs}`, {
    headers: authHeaders(token) as Record<string, string>,
    cache: 'no-store',
  });
  const body = await parseJson<{ items?: B2bUnmatchedRow[]; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'B2B unmatched request failed', res.status);
  }
  return Array.isArray(body.items) ? body.items : [];
}

export async function mapB2bUnmatched(
  token: string,
  id: string,
  body: { project_id: string; page_id?: string },
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/api/v1/b2b-unmatched/${id}/map`, {
    method: 'POST',
    headers: {
      ...(authHeaders(token) as Record<string, string>),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const out = await parseJson<{ ok?: boolean; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(out.error ?? 'Map unmatched failed', res.status);
  }
  return { ok: Boolean(out.ok) };
}
