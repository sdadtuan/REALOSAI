import { tierFromSkuCode } from '../spc/spc-sku.util';
import type { QuoteLineInput } from '../proposals/proposals.types';

export interface LmpOfferLadderRow {
  tier?: string;
  dv_code?: string;
  sku_code?: string;
  headline_vi?: string;
  label_vi?: string;
  price_hint_vnd?: number | null;
}

const TIER_TO_PACKAGE: Record<string, 'basic' | 'standard' | 'premium'> = {
  CB: 'basic',
  TC: 'standard',
  CS: 'premium',
};

export function buildQuoteLinesFromOfferLadder(ladder: LmpOfferLadderRow[]): QuoteLineInput[] {
  if (!Array.isArray(ladder) || ladder.length !== 3) {
    throw new Error('offer_ladder_must_have_3_tiers');
  }

  return ladder.map((item) => {
    const skuCode = String(item.sku_code ?? '').trim();
    const dvCode = String(item.dv_code ?? '').trim().toUpperCase();
    const tierKey = String(item.tier ?? '').trim().toUpperCase();
    const packageTier =
      (skuCode ? tierFromSkuCode(skuCode) : null) ?? TIER_TO_PACKAGE[tierKey] ?? 'standard';
    const scopeNotes = String(item.headline_vi ?? item.label_vi ?? '').trim();

    const line: QuoteLineInput = {
      package_tier: packageTier,
      scope_notes: scopeNotes,
    };
    if (skuCode) line.sku_code = skuCode;
    if (dvCode) line.dv_code = dvCode;
    if (item.price_hint_vnd != null && Number.isFinite(Number(item.price_hint_vnd))) {
      line.final_price_vnd = Math.max(0, Number(item.price_hint_vnd));
    }
    return line;
  });
}
