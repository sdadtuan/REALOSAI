import type { MktAiBrief } from './marketing-ai-planner.types';

/** Label patterns for heuristic brief extract (VI + EN). */
const FIELD_PATTERNS: Array<{ key: keyof MktAiBrief; patterns: RegExp[] }> = [
  {
    key: 'brand_name',
    patterns: [
      /(?:thương hiệu|tên (?:thương hiệu|khách hàng|KH|brand)|brand\s*name?)\s*[:\-–]\s*(.+)/i,
    ],
  },
  {
    key: 'industry',
    patterns: [/(?:ngành|lĩnh vực|industry)\s*[:\-–]\s*(.+)/i],
  },
  {
    key: 'objective',
    patterns: [/(?:mục tiêu|objective)\s*[:\-–]\s*(.+)/i],
  },
  {
    key: 'budget_monthly_vnd',
    patterns: [
      /(?:ngân sách|budget)\s*(?:tháng|monthly)?\s*[:\-–]\s*([\d.,\s]+(?:triệu|tr|vnd|đ|₫)?)/i,
    ],
  },
  {
    key: 'geo_markets',
    patterns: [/(?:thị trường|geo|khu vực|market)\s*[:\-–]\s*(.+)/i],
  },
  {
    key: 'challenges',
    patterns: [/(?:thách thức|pain|challenge)\s*[:\-–]\s*(.+)/i],
  },
  {
    key: 'usp',
    patterns: [/(?:usp|điểm mạnh|value prop)\s*[:\-–]\s*(.+)/i],
  },
  {
    key: 'competitors',
    patterns: [/(?:đối thủ|competitor)\s*[:\-–]\s*(.+)/i],
  },
  {
    key: 'website_url',
    patterns: [/(?:website|url)\s*[:\-–]\s*(https?:\/\/\S+|www\.\S+)/i],
  },
];

function parseBudget(raw: string): number | undefined {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  const trieu = s.match(/([\d.,]+)\s*triệu/);
  if (trieu) {
    const n = Number(trieu[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 1_000_000) : undefined;
  }
  const digits = s.replace(/[^\d]/g, '');
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function normalizeObjective(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (v.includes('lead')) return 'lead';
  if (v.includes('awareness') || v.includes('nhận diện')) return 'awareness';
  if (v.includes('sales') || v.includes('bán')) return 'sales';
  if (v.includes('retention') || v.includes('giữ chân')) return 'retention';
  return raw.trim();
}

function lineValue(text: string, pattern: RegExp): string | undefined {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(pattern);
    if (m?.[1]?.trim()) return m[1].trim();
  }
  const block = text.match(pattern);
  return block?.[1]?.trim();
}

export function extractBriefFieldsFromText(text: string): Partial<MktAiBrief> {
  const out: Partial<MktAiBrief> = {};
  const normalized = text.replace(/\u0000/g, ' ').trim();
  if (!normalized) return out;

  for (const { key, patterns } of FIELD_PATTERNS) {
    for (const pattern of patterns) {
      const raw = lineValue(normalized, pattern);
      if (!raw) continue;
      if (key === 'budget_monthly_vnd') {
        const n = parseBudget(raw);
        if (n) out.budget_monthly_vnd = n;
      } else if (key === 'geo_markets' || key === 'competitors') {
        out[key] = raw.split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
      } else if (key === 'objective') {
        out.objective = normalizeObjective(raw);
      } else {
        (out as Record<string, unknown>)[key] = raw;
      }
      break;
    }
  }

  return out;
}
