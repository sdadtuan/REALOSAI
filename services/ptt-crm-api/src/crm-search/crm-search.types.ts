export const SEARCH_ENTITY_TYPES = [
  'account',
  'contact',
  'lead',
  'deal',
  'email',
  'note',
  'ticket',
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export interface SearchEntityDocument {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle?: string;
  body?: string;
  route_path?: string;
  updated_at?: string;
}

export interface SearchHit {
  entity_type: SearchEntityType;
  entity_id: string;
  title: string;
  subtitle?: string;
  snippet?: string;
  route_path?: string;
  score: number;
}

export interface SearchQuery {
  q: string;
  entity_type?: SearchEntityType;
  limit?: number;
}

export interface SearchResponse {
  data: {
    query: string;
    entity_type: SearchEntityType | null;
    hits: SearchHit[];
    total: number;
    engine: 'opensearch';
    index: string;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: [];
}

export interface SearchHealthResponse {
  data: {
    status: 'ready' | 'degraded' | 'unconfigured';
    index: string;
    opensearch_url: string | null;
    opensearch_reachable: boolean;
    opensearch_required: boolean;
    document_count_estimate?: number;
  };
  meta: { request_id: string };
  errors: [];
}

export interface ReindexResponse {
  data: {
    indexed: number;
    engine: 'opensearch';
    index: string;
  };
  meta: { request_id: string };
  errors: [];
}

export function normalizeSearchEntityType(raw?: string): SearchEntityType | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (!v) return null;
  return (SEARCH_ENTITY_TYPES as readonly string[]).includes(v) ? (v as SearchEntityType) : null;
}

export function buildSearchSnippet(text: string, query: string, max = 120): string {
  const body = text.replace(/\s+/g, ' ').trim();
  if (!body) return '';
  const q = query.trim().toLowerCase();
  if (!q) return body.slice(0, max);
  const idx = body.toLowerCase().indexOf(q);
  if (idx < 0) return body.slice(0, max);
  const start = Math.max(0, idx - 30);
  const end = Math.min(body.length, idx + q.length + 60);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < body.length ? '…' : '';
  return `${prefix}${body.slice(start, end)}${suffix}`;
}
