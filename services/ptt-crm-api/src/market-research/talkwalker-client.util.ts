import type { TalkwalkerNormalized } from './market-research.types';

export const TALKWALKER_DEFAULT_BASE = 'https://api.talkwalker.com';
export const TALKWALKER_SEARCH_TIMEOUT_MS = 30_000;
export const TALKWALKER_RESULT_LIMIT = 10;

export type TalkwalkerHttpTransport = (input: {
  method: 'GET';
  url: string;
  headers: Record<string, string>;
  timeoutMs: number;
}) => Promise<{ status: number; json: () => Promise<unknown> }>;

export function normalizeTalkwalkerSearchResponse(
  raw: unknown,
  limit = TALKWALKER_RESULT_LIMIT,
): TalkwalkerNormalized {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.results)
    ? obj.results
    : Array.isArray(obj.data)
      ? obj.data
      : Array.isArray(obj.mentions)
        ? obj.mentions
        : [];
  const cap = Math.max(1, Math.min(limit, 50));
  const results: TalkwalkerNormalized['results'] = [];
  for (const row of rows.slice(0, cap)) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const url = String(item.url ?? item.source_url ?? item.link ?? '').trim();
    const title = String(item.title ?? item.headline ?? item.name ?? '').trim();
    const snippet = String(item.snippet ?? item.content ?? item.text ?? item.summary ?? '')
      .trim()
      .slice(0, 500);
    if (!url || !title) continue;
    results.push({
      url,
      title: title.slice(0, 500),
      snippet,
      source_name: item.source_name != null ? String(item.source_name) : undefined,
      published_at: item.published_at != null ? String(item.published_at) : undefined,
    });
  }
  return { results };
}

export async function fetchTalkwalkerSearchResults(
  input: {
    query: string;
    accessToken: string;
    projectId: string;
    limit?: number;
    baseUrl?: string;
  },
  transport: TalkwalkerHttpTransport = defaultTalkwalkerTransport,
): Promise<TalkwalkerNormalized> {
  const base = (input.baseUrl ?? process.env.TALKWALKER_API_BASE_URL ?? TALKWALKER_DEFAULT_BASE).replace(
    /\/$/,
    '',
  );
  const limit = input.limit ?? TALKWALKER_RESULT_LIMIT;
  const q = encodeURIComponent(input.query.trim());
  const token = encodeURIComponent(input.accessToken.trim());
  const projectId = encodeURIComponent(input.projectId.trim());
  const url =
    `${base}/api/v1/search/p/${projectId}/results?access_token=${token}&q=${q}&limit=${limit}`;
  const res = await transport({
    method: 'GET',
    url,
    headers: { Accept: 'application/json' },
    timeoutMs: TALKWALKER_SEARCH_TIMEOUT_MS,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`talkwalker_search_http_${res.status}`);
  }
  return normalizeTalkwalkerSearchResponse(await res.json(), limit);
}

async function defaultTalkwalkerTransport(
  input: Parameters<TalkwalkerHttpTransport>[0],
): ReturnType<TalkwalkerHttpTransport> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), input.timeoutMs);
  try {
    const res = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      signal: ctrl.signal,
    });
    return { status: res.status, json: () => res.json() };
  } finally {
    clearTimeout(timer);
  }
}
