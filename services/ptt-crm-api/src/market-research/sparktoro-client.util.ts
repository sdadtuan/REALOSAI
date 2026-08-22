export type SparktoroLocation = 'us' | 'ca' | 'uk';

export const SPARKTORO_DEFAULT_BASE = 'https://api.sparktoro.com';
export const SPARKTORO_WEBSITE_LIMIT = 10;
export const SPARKTORO_CREATE_TIMEOUT_MS = 45_000;
export const SPARKTORO_GET_TIMEOUT_MS = 20_000;

export type SparktoroHttpTransport = (input: {
  method: 'GET' | 'POST';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs: number;
}) => Promise<{ status: number; json: () => Promise<unknown> }>;

export function resolveSparktoroLocation(geo: string[], override?: string): SparktoroLocation {
  const fromEnv = (override ?? process.env.SPARKTORO_LOCATION ?? 'us').trim().toLowerCase();
  const tokens = geo.map((g) => g.trim().toUpperCase()).filter(Boolean);
  if (tokens.some((t) => t === 'UK' || t === 'GB')) return 'uk';
  if (tokens.some((t) => t === 'CA' || t === 'CANADA')) return 'ca';
  if (fromEnv === 'uk' || fromEnv === 'ca' || fromEnv === 'us') return fromEnv;
  return 'us';
}

export function normalizeSparktoroWebsites(
  raw: unknown,
  limit = SPARKTORO_WEBSITE_LIMIT,
): {
  results: Array<{ url: string; title: string; snippet: string }>;
  credits_charged: number;
} {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const meta = obj.meta && typeof obj.meta === 'object' ? (obj.meta as Record<string, unknown>) : {};
  const rows = Array.isArray(obj.data) ? obj.data : [];
  const cap = Math.max(1, Math.min(limit, 50));
  const results: Array<{ url: string; title: string; snippet: string }> = [];
  for (const row of rows.slice(0, cap)) {
    if (!row || typeof row !== 'object') continue;
    const item = row as Record<string, unknown>;
    const domain = String(item.domain ?? '').trim().toLowerCase();
    if (!domain) continue;
    const affinity = Number(item.affinity);
    const category = String(item.category ?? '').trim();
    const metaDesc = String(item.meta_description ?? '').trim();
    const snippet =
      metaDesc ||
      [Number.isFinite(affinity) ? `Affinity ${Math.round(affinity)}%` : '', category]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 500);
    results.push({
      url: domain.startsWith('http') ? domain : `https://${domain}`,
      title: domain.slice(0, 500),
      snippet,
    });
  }
  return { results, credits_charged: Number(meta.credits_charged ?? 0) || 0 };
}

export async function fetchSparktoroAudienceWebsites(
  input: {
    query: string;
    apiKey: string;
    location: SparktoroLocation;
    limit?: number;
    baseUrl?: string;
  },
  transport: SparktoroHttpTransport = defaultSparktoroTransport,
): Promise<{
  results: Array<{ url: string; title: string; snippet: string }>;
  credits_used: number;
  report_id: string;
  location: SparktoroLocation;
}> {
  const base = (input.baseUrl ?? process.env.SPARKTORO_API_BASE_URL ?? SPARKTORO_DEFAULT_BASE).replace(
    /\/$/,
    '',
  );
  const limit = input.limit ?? SPARKTORO_WEBSITE_LIMIT;
  const auth = { Authorization: `Bearer ${input.apiKey}`, 'Content-Type': 'application/json' };
  const create = await transport({
    method: 'POST',
    url: `${base}/v3/describe/create`,
    headers: auth,
    body: { prompt: input.query, location: input.location },
    timeoutMs: SPARKTORO_CREATE_TIMEOUT_MS,
  });
  if (create.status < 200 || create.status >= 300) {
    throw new Error(`sparktoro_create_http_${create.status}`);
  }
  const created = (await create.json()) as Record<string, unknown>;
  const reportId = String(created.report_id ?? '').trim();
  if (!reportId) throw new Error('sparktoro_missing_report_id');
  const websites = await transport({
    method: 'GET',
    url: `${base}/v3/websites?report_id=${encodeURIComponent(reportId)}&limit=${limit}`,
    headers: { Authorization: `Bearer ${input.apiKey}` },
    timeoutMs: SPARKTORO_GET_TIMEOUT_MS,
  });
  if (websites.status < 200 || websites.status >= 300) {
    throw new Error(`sparktoro_websites_http_${websites.status}`);
  }
  const normalized = normalizeSparktoroWebsites(await websites.json(), limit);
  return {
    results: normalized.results,
    credits_used: 10 + normalized.credits_charged,
    report_id: reportId,
    location: input.location,
  };
}

async function defaultSparktoroTransport(
  input: Parameters<SparktoroHttpTransport>[0],
): ReturnType<SparktoroHttpTransport> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), input.timeoutMs);
  try {
    const res = await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body ? JSON.stringify(input.body) : undefined,
      signal: ctrl.signal,
    });
    return { status: res.status, json: () => res.json() };
  } finally {
    clearTimeout(timer);
  }
}
