import { API_BASE, ApiError, parseJson } from './api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface LeadCallTokenResponse {
  access_token: string;
  user_id: string;
  from_number: string;
  to_number: string;
  lead_id: number;
}

export async function fetchLeadCallToken(
  token: string,
  leadId: number,
): Promise<LeadCallTokenResponse> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/calls/token`, {
    method: 'POST',
    headers: {
      ...(authHeaders(token) as Record<string, string>),
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
  const body = await parseJson<LeadCallTokenResponse & { error?: string; tel?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Call token failed', res.status);
  }
  return body;
}

export async function startLeadB2bCall(
  token: string,
  leadId: number,
): Promise<{ ok: boolean; sessionId: string; providerCallId: string }> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/calls`, {
    method: 'POST',
    headers: {
      ...(authHeaders(token) as Record<string, string>),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ kind: 'human' }),
    cache: 'no-store',
  });
  const body = await parseJson<{ ok?: boolean; sessionId?: string; providerCallId?: string; error?: string; tel?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Call start failed', res.status);
  }
  return {
    ok: Boolean(body.ok),
    sessionId: String(body.sessionId ?? ''),
    providerCallId: String(body.providerCallId ?? ''),
  };
}
