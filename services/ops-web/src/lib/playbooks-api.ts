import { API_BASE, ApiError, parseJson } from '@/lib/api';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export interface PlaybookRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  status: string;
  tags: string[];
  chunk_count?: number;
  updated_at: string;
}

export interface PlaybookChunkRow {
  id: string;
  chunk_key: string;
  title: string;
  body: string;
  sort_order: number;
}

export interface PlaybookCitation {
  playbook_id: string;
  playbook_title: string;
  chunk_id: string;
  chunk_title: string;
  excerpt: string;
  score: number;
}

export async function fetchPlaybooks(
  token: string,
  opts?: { limit?: number; offset?: number },
): Promise<{ data: { rows: PlaybookRow[]; total: number } }> {
  const qs = new URLSearchParams();
  if (opts?.limit != null) qs.set('limit', String(opts.limit));
  if (opts?.offset != null) qs.set('offset', String(opts.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/v1/ai/playbooks${suffix}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{ data?: { rows?: PlaybookRow[]; total?: number }; error?: string; message?: string }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch playbooks failed', res.status);
  }
  return body as { data: { rows: PlaybookRow[]; total: number } };
}

export async function fetchPlaybookById(
  token: string,
  id: string,
): Promise<{ data: { playbook: PlaybookRow; chunks: PlaybookChunkRow[] } }> {
  const res = await fetch(`${API_BASE}/api/v1/ai/playbooks/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const body = await parseJson<{
    data?: { playbook?: PlaybookRow; chunks?: PlaybookChunkRow[] };
    error?: string;
    message?: string;
  }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Fetch playbook failed', res.status);
  }
  return body as { data: { playbook: PlaybookRow; chunks: PlaybookChunkRow[] } };
}

export async function postPlaybookRagQuery(
  token: string,
  input: { query: string; playbook_id?: string; limit?: number },
): Promise<{
  data: {
    query: string;
    answer: string;
    citations: PlaybookCitation[];
    retrieval_engine: 'vector' | 'keyword';
    stub_mode: boolean;
  };
}> {
  const res = await fetch(`${API_BASE}/api/v1/ai/playbooks/rag/query`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await parseJson<{
    data?: {
      query: string;
      answer: string;
      citations: PlaybookCitation[];
      retrieval_engine: 'vector' | 'keyword';
      stub_mode: boolean;
    };
    error?: string;
    message?: string;
  }>(res);
  if (!res.ok) {
    throw new ApiError(body.message ?? body.error ?? 'Playbook RAG query failed', res.status);
  }
  return body as {
    data: {
      query: string;
      answer: string;
      citations: PlaybookCitation[];
      retrieval_engine: 'vector' | 'keyword';
      stub_mode: boolean;
    };
  };
}
