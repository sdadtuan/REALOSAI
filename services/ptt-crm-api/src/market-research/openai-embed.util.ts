import {
  OPENAI_EMBED_DIMS,
  OPENAI_EMBED_MODEL,
  OPENAI_EMBED_URL,
  type InsightEmbedResult,
} from './market-research.types';

export type OpenAIEmbedTransport = (input: {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  body: unknown;
}) => Promise<{ status: number; json: () => Promise<unknown> }>;

function clampEmbedDims(raw: number): number {
  return Math.min(1536, Math.max(64, Math.floor(raw)));
}

function resolveEmbedDims(override?: number): number {
  if (override !== undefined) return clampEmbedDims(override);
  const fromEnv = Number(process.env.OPENAI_EMBED_DIMS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return clampEmbedDims(fromEnv);
  return OPENAI_EMBED_DIMS;
}

function resolveEmbedModel(override?: string): string {
  const fromEnv = (process.env.OPENAI_EMBED_MODEL ?? '').trim();
  return override ?? (fromEnv || OPENAI_EMBED_MODEL);
}

export function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) return vec.map(() => 0);
  return vec.map((v) => v / norm);
}

async function defaultTransport(input: {
  method: 'POST';
  url: string;
  headers: Record<string, string>;
  body: unknown;
}): Promise<{ status: number; json: () => Promise<unknown> }> {
  const res = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: JSON.stringify(input.body),
  });
  return { status: res.status, json: () => res.json() as Promise<unknown> };
}

export async function fetchOpenAIEmbedding(
  input: { text: string; apiKey: string; model?: string; dims?: number },
  transport: OpenAIEmbedTransport = defaultTransport,
): Promise<InsightEmbedResult> {
  const model = resolveEmbedModel(input.model);
  const dims = resolveEmbedDims(input.dims);
  const res = await transport({
    method: 'POST',
    url: OPENAI_EMBED_URL,
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: { model, input: input.text, dimensions: dims },
  });
  if (res.status < 200 || res.status >= 300) {
    throw Object.assign(new Error('openai_embed_failed'), { code: 'openai_embed_failed' });
  }
  const body = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const raw = body.data?.[0]?.embedding;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw Object.assign(new Error('openai_embed_failed'), { code: 'openai_embed_failed' });
  }
  return { embedding: l2Normalize(raw), model: OPENAI_EMBED_MODEL, dims: raw.length };
}
