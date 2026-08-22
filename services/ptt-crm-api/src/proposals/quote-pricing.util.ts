export type QuotePackageTier = 'basic' | 'standard' | 'premium';

export const QUOTE_PACKAGE_TIERS: QuotePackageTier[] = ['basic', 'standard', 'premium'];

export const QUOTE_TIER_VI: Record<QuotePackageTier, string> = {
  basic: 'Cơ bản',
  standard: 'Tiêu chuẩn',
  premium: 'Chuyên sâu',
};

/** Legacy SRS tier keys in catalog JSON. */
export const QUOTE_TIER_LEGACY: Record<QuotePackageTier, string> = {
  basic: 'CoBan',
  standard: 'TieuChuan',
  premium: 'ChuyenSau',
};

export type QuoteTierPricing = {
  price_vnd?: number;
  min_vnd?: number;
  max_vnd?: number;
};

export const DEFAULT_QUOTE_TIER_PRICING: Record<QuotePackageTier, QuoteTierPricing> = {
  basic: { price_vnd: 10000000, min_vnd: 8000000, max_vnd: 12000000 },
  standard: { price_vnd: 20000000, min_vnd: 16000000, max_vnd: 25000000 },
  premium: { price_vnd: 35000000, min_vnd: 28000000, max_vnd: 45000000 },
};

export type QuoteReferencePrice = {
  min_vnd: number;
  max_vnd: number;
  suggested_vnd: number;
};

export function normalizeQuoteTier(raw: string): QuotePackageTier | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s === 'basic' || s === 'coban' || s === 'co_ban') return 'basic';
  if (s === 'standard' || s === 'tieuchuan' || s === 'tieu_chuan') return 'standard';
  if (s === 'premium' || s === 'chuyensau' || s === 'chuyen_sau') return 'premium';
  return null;
}

export function resolveTierPricing(
  tierPricing: Record<string, unknown>,
  tier: QuotePackageTier,
  allowDefaultFallback = true,
): QuoteReferencePrice {
  const keys = [tier, QUOTE_TIER_LEGACY[tier], QUOTE_TIER_LEGACY[tier].toLowerCase()];
  let raw: Record<string, unknown> | null = null;
  for (const key of keys) {
    const candidate = tierPricing[key];
    if (candidate && typeof candidate === 'object') {
      raw = candidate as Record<string, unknown>;
      break;
    }
  }
  const price = Number(raw?.price_vnd ?? raw?.price ?? 0);
  const min = Number(raw?.min_vnd ?? raw?.min ?? price);
  const max = Number(raw?.max_vnd ?? raw?.max ?? price);
  const min_vnd = Number.isFinite(min) && min > 0 ? min : price;
  const max_vnd = Number.isFinite(max) && max > 0 ? max : min_vnd;
  const suggested_vnd =
    Number.isFinite(price) && price > 0 ? price : Math.round((min_vnd + max_vnd) / 2);
  const result = {
    min_vnd: Math.max(0, min_vnd),
    max_vnd: Math.max(min_vnd, max_vnd),
    suggested_vnd: Math.max(0, suggested_vnd),
  };
  if (result.suggested_vnd <= 0 && allowDefaultFallback) {
    return resolveTierPricing(DEFAULT_QUOTE_TIER_PRICING as Record<string, unknown>, tier, false);
  }
  return result;
}

export function quotePdfBuffer(input: {
  proposalId: number;
  customerName: string;
  lines: Array<{
    dv_code: string;
    dv_name: string;
    package_tier: string;
    final_price_vnd: number;
  }>;
  total_vnd: number;
  status: string;
  valid_until?: string | null;
}): Buffer {
  const title = `Bao gia #${input.proposalId}`.replace(/[()\\]/g, ' ');
  const customer = input.customerName.slice(0, 60).replace(/[()\\]/g, ' ');
  const lineText = input.lines
    .map(
      (l) =>
        `${l.dv_code} ${l.dv_name} (${l.package_tier}): ${l.final_price_vnd.toLocaleString('vi-VN')} VND`,
    )
    .join(' · ')
    .slice(0, 400)
    .replace(/[()\\]/g, ' ');
  const total = `Tong: ${input.total_vnd.toLocaleString('vi-VN')} VND · ${input.status}`;
  const bodyText = [customer, lineText, total].filter(Boolean).join(' · ');
  const pdf = `%PDF-1.1
1 0 obj<<>>endobj
2 0 obj<</Length ${bodyText.length + 120}>>stream
BT /F1 11 Tf 48 760 Td (${title}) Tj 0 -18 Td (${bodyText}) Tj ET
endstream
endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Contents 2 0 R>>endobj
4 0 obj<</Type/Catalog/Pages<</Kids[3 0 R]/Count 1>>>>endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000200 00000 n 
0000000280 00000 n 
trailer<</Size 5/Root 4 0 R>>
startxref
340
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

export function quoteExportFilename(proposalId: number, format: 'pdf' | 'docx'): string {
  return `ptt-quote-${proposalId}.${format}`;
}
