import { API_BASE, ApiError, parseJson } from './api';

export interface B2bSpeedStaffRow {
  staff_id: number;
  n: number;
  p50_seconds: number;
}

export interface B2bSpeedReport {
  project_id: string;
  days: number;
  p50_seconds: number;
  p95_seconds: number;
  hot_p95_seconds: number;
  n: number;
  by_staff: B2bSpeedStaffRow[];
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchB2bSpeedReport(
  token: string,
  input: { projectId: string; days?: number },
): Promise<B2bSpeedReport> {
  const params = new URLSearchParams();
  params.set('project_id', input.projectId);
  if (input.days != null) params.set('days', String(input.days));
  const res = await fetch(`${API_BASE}/api/v1/b2b-speed?${params.toString()}`, {
    headers: authHeaders(token) as Record<string, string>,
    cache: 'no-store',
  });
  const body = await parseJson<B2bSpeedReport & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Speed report failed', res.status);
  }
  return body;
}
