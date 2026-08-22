import { API_BASE, ApiError, parseJson } from './api';

export interface B2bOpsSummary {
  unmatched_24h: number;
  hop_ge_2: number;
  sla_breach: number;
  cpaas_fail_24h: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchB2bOpsSummary(
  token: string,
  projectId?: string,
): Promise<B2bOpsSummary> {
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  const res = await fetch(`${API_BASE}/api/v1/b2b-ops-summary${qs}`, {
    headers: authHeaders(token) as Record<string, string>,
    cache: 'no-store',
  });
  const body = await parseJson<B2bOpsSummary & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Ops summary failed', res.status);
  }
  return body;
}
