import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export type SearchEntityType = 'account' | 'contact' | 'lead' | 'deal' | 'email' | 'note' | 'ticket';

export interface GlobalSearchHit {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  route_path?: string;
  score: number;
}

export interface GlobalSearchResponse {
  data: {
    query: string;
    entity_type: SearchEntityType | null;
    hits: GlobalSearchHit[];
    total: number;
    engine: 'opensearch';
    index: string;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: unknown[];
}

export const SEARCH_ENTITY_LABELS: Record<SearchEntityType, string> = {
  account: 'Account',
  contact: 'Contact',
  lead: 'Lead',
  deal: 'Deal',
  email: 'Email',
  note: 'Note',
  ticket: 'Ticket',
};

export async function fetchGlobalSearch(
  token: string,
  q: string,
  opts?: { entity_type?: SearchEntityType; limit?: number },
): Promise<GlobalSearchResponse> {
  const qs = new URLSearchParams({ q });
  if (opts?.entity_type) qs.set('entity_type', opts.entity_type);
  if (opts?.limit != null) qs.set('limit', String(opts.limit));
  const res = await fetch(`${API_BASE}/api/v1/search?${qs.toString()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<GlobalSearchResponse & { error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Search failed', res.status);
  }
  return body;
}

export async function fetchSearchHealth(token: string): Promise<{ data: { status: string } }> {
  const res = await fetch(`${API_BASE}/api/v1/search/health`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ data: { status: string }; error?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Search health failed', res.status);
  }
  return body;
}
