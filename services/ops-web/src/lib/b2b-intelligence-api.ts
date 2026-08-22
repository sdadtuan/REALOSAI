import { API_BASE, ApiError, parseJson } from './api';

export interface B2bScoreReason {
  feature: string;
  direction: '+' | '-';
  weight: number;
}

export interface B2bLeadIntelligence {
  lead_id: number;
  score: {
    score: number | null;
    band: 'hot' | 'warm' | 'cold';
    reasons: B2bScoreReason[];
  };
  nba: {
    action: 'call' | 'note' | 'meet';
    label_vi: string;
    due_in_seconds: number;
  } | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchB2bLeadIntelligence(
  token: string,
  leadId: number,
): Promise<B2bLeadIntelligence> {
  const res = await fetch(`${API_BASE}/api/v1/leads/${leadId}/b2b-intelligence`, {
    headers: authHeaders(token) as Record<string, string>,
    cache: 'no-store',
  });
  const body = await parseJson<B2bLeadIntelligence & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'B2B intelligence failed', res.status);
  }
  return body;
}

export interface B2bRoutingAbReport {
  ai_win_rate: number | null;
  hybrid_win_rate: number | null;
  n: number;
}

export async function fetchB2bRoutingAbReport(
  token: string,
  days = 30,
): Promise<B2bRoutingAbReport> {
  const res = await fetch(`${API_BASE}/api/v1/b2b-routing-ab?days=${days}`, {
    headers: authHeaders(token) as Record<string, string>,
    cache: 'no-store',
  });
  const body = await parseJson<B2bRoutingAbReport & { error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Routing A/B report failed', res.status);
  }
  return body;
}
