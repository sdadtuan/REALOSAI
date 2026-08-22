export type PlaybookStatus = 'draft' | 'active' | 'archived';

export interface PlaybookRecord {
  id: string;
  client_id: string | null;
  slug: string;
  title: string;
  category: string;
  summary: string;
  status: PlaybookStatus;
  tags: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  chunk_count?: number;
}

export interface PlaybookChunkRecord {
  id: string;
  playbook_id: string;
  chunk_key: string;
  title: string;
  body: string;
  embedding_json: number[] | null;
  token_count: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlaybookCitation {
  playbook_id: string;
  playbook_title: string;
  chunk_id: string;
  chunk_title: string;
  excerpt: string;
  score: number;
}

export interface PlaybookRagQuery {
  query: string;
  playbook_id?: string;
  limit?: number;
}

export interface PlaybookRagResponse {
  data: {
    query: string;
    answer: string;
    citations: PlaybookCitation[];
    retrieval_engine: 'vector' | 'keyword';
    stub_mode: boolean;
  };
  meta: { request_id: string; latency_ms?: number };
  errors: [];
}

export interface PlaybookListResponse {
  data: { rows: PlaybookRecord[]; total: number };
  meta: { request_id: string };
  errors: [];
}

export interface PlaybookDetailResponse {
  data: { playbook: PlaybookRecord; chunks: PlaybookChunkRecord[] };
  meta: { request_id: string };
  errors: [];
}

export interface CreatePlaybookBody {
  slug?: string;
  title: string;
  category?: string;
  summary?: string;
  tags?: string[];
}

export interface CreatePlaybookChunkBody {
  chunk_key: string;
  title?: string;
  body: string;
  sort_order?: number;
}

/** Deterministic pseudo-embedding for vector store v1 (RNOS-12). */
export function embedPlaybookText(text: string, dims = 64): number[] {
  const vec = new Array<number>(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
  for (const token of tokens) {
    let h = 0;
    for (let i = 0; i < token.length; i += 1) {
      h = (Math.imul(31, h) + token.charCodeAt(i)) >>> 0;
    }
    vec[h % dims] += 1;
  }
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
}

export function keywordScore(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const hay = text.toLowerCase();
  if (!hay.includes(q)) return 0;
  let score = 1;
  if (hay.startsWith(q)) score += 2;
  const tokens = q.split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    if (hay.includes(t)) score += 0.5;
  }
  return score;
}

export function buildRagAnswer(query: string, citations: PlaybookCitation[]): string {
  if (!citations.length) {
    return `Không tìm thấy playbook phù hợp cho "${query}". Thử từ khóa khác hoặc bổ sung chunk.`;
  }
  const lines = citations.slice(0, 3).map((c, i) => `${i + 1}. [${c.playbook_title}] ${c.excerpt}`);
  return `Gợi ý theo playbook:\n${lines.join('\n')}`;
}
