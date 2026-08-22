import { API_BASE, ApiError, parseJson } from './api';

export interface B2bLeadAlertRow {
  id: string;
  lead_id: number;
  staff_id: number;
  severity: string;
  kind: string;
  read_at: string | null;
  created_at: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function parseB2bLeadAlerts(body: unknown): B2bLeadAlertRow[] {
  const items = Array.isArray(body)
    ? body
    : (body as { items?: unknown })?.items;
  if (!Array.isArray(items)) return [];
  return items.map((row) => {
    const r = row as B2bLeadAlertRow;
    return {
      id: String(r.id),
      lead_id: Number(r.lead_id),
      staff_id: Number(r.staff_id),
      severity: String(r.severity),
      kind: String(r.kind),
      read_at: r.read_at ? String(r.read_at) : null,
      created_at: String(r.created_at),
    };
  });
}

export async function fetchB2bLeadAlerts(
  token: string,
  opts?: { scope?: 'all'; limit?: number },
): Promise<B2bLeadAlertRow[]> {
  const params = new URLSearchParams();
  if (opts?.scope === 'all') params.set('scope', 'all');
  if (opts?.limit != null) params.set('limit', String(opts.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/b2b-lead-alerts${qs}`, {
    headers: authHeaders(token) as Record<string, string>,
    cache: 'no-store',
  });
  const body = await parseJson<{ items?: unknown; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'B2B alerts request failed', res.status);
  }
  return parseB2bLeadAlerts(body);
}

export function b2bLeadAlertsStreamUrl(token: string): string {
  const qs = new URLSearchParams({ access_token: token });
  return `${API_BASE}/api/v1/b2b-lead-alerts/stream?${qs.toString()}`;
}
