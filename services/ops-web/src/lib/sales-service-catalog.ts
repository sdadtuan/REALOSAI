import {
  formatPricingModelBrief,
  pricingModelRange,
  QUOTE_TIER_LABEL,
  type QuoteCatalogFamily,
  type QuoteCatalogOffer,
} from './quote-api';

export type SalesCatalogSkuRow = {
  dv_code: string;
  name_vi: string;
  service_slug: string;
  readiness: string;
  depends_on_dv: string[];
  default_sku_code: string;
  sku_code: string;
  tier: QuoteCatalogOffer['tier'];
  tier_label: string;
  label_vi: string;
  scope_summary_vi: string;
  pricing_label: string;
  price_min: number;
  price_max: number;
  line_count: number;
  search_blob: string;
};

export type SalesCatalogFilters = {
  query: string;
  readiness: 'all' | 'ready' | 'partial' | 'gap';
  tier: 'all' | 'CB' | 'TC' | 'CS';
};

export function flattenQuoteCatalog(families: QuoteCatalogFamily[]): SalesCatalogSkuRow[] {
  const rows: SalesCatalogSkuRow[] = [];
  for (const family of families) {
    for (const offer of family.offers ?? []) {
      const range = pricingModelRange(offer.pricing_model);
      const tierKey =
        offer.tier === 'CB' ? 'basic' : offer.tier === 'CS' ? 'premium' : 'standard';
      rows.push({
        dv_code: family.dv_code,
        name_vi: family.name_vi,
        service_slug: family.service_slug,
        readiness: family.readiness,
        depends_on_dv: family.depends_on_dv ?? [],
        default_sku_code: family.default_sku_code,
        sku_code: offer.sku_code,
        tier: offer.tier,
        tier_label: QUOTE_TIER_LABEL[tierKey] ?? offer.tier,
        label_vi: offer.label_vi,
        scope_summary_vi: offer.scope_summary_vi,
        pricing_label: formatPricingModelBrief(offer.pricing_model),
        price_min: range.min_vnd,
        price_max: range.max_vnd,
        line_count: offer.lines?.length ?? 0,
        search_blob: [
          family.dv_code,
          family.name_vi,
          family.service_slug,
          offer.sku_code,
          offer.label_vi,
          offer.scope_summary_vi,
          offer.tier,
          ...(offer.lines ?? []).map((l) => `${l.label_vi} ${l.description_vi}`),
        ]
          .join(' ')
          .toLowerCase(),
      });
    }
  }
  return rows;
}

export function filterSalesCatalog(
  rows: SalesCatalogSkuRow[],
  filters: SalesCatalogFilters,
): SalesCatalogSkuRow[] {
  const q = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filters.readiness !== 'all' && row.readiness !== filters.readiness) return false;
    if (filters.tier !== 'all' && row.tier !== filters.tier) return false;
    if (!q) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.every((t) => row.search_blob.includes(t));
  });
}

export function groupSkusByFamily(rows: SalesCatalogSkuRow[]): Map<string, SalesCatalogSkuRow[]> {
  const map = new Map<string, SalesCatalogSkuRow[]>();
  for (const row of rows) {
    const list = map.get(row.dv_code) ?? [];
    list.push(row);
    map.set(row.dv_code, list);
  }
  return map;
}

export function readinessLabel(readiness: string): string {
  if (readiness === 'ready') return 'Sẵn sàng';
  if (readiness === 'partial') return 'Một phần';
  if (readiness === 'gap') return 'Gap';
  return readiness;
}
