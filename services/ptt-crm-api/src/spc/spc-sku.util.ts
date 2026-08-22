import type { QuotePackageTier } from '../proposals/quote-pricing.util';

const TIER_TO_SKU: Record<QuotePackageTier, string> = {
  basic: 'CB',
  standard: 'TC',
  premium: 'CS',
};

const SKU_TO_TIER: Record<string, QuotePackageTier> = {
  CB: 'basic',
  TC: 'standard',
  CS: 'premium',
};

export function tierFromSkuCode(skuCode: string): QuotePackageTier | null {
  const tier = String(skuCode ?? '').trim().toUpperCase().split('-').pop();
  if (!tier) return null;
  return SKU_TO_TIER[tier] ?? null;
}

export function skuFromDvTier(dvCode: string, tier: QuotePackageTier): string {
  return `${String(dvCode).trim().toUpperCase()}-${TIER_TO_SKU[tier]}`;
}

export function dvCodeFromSku(skuCode: string): string {
  const parts = String(skuCode ?? '').trim().toUpperCase().split('-');
  return parts.length >= 2 ? parts[0] : String(skuCode ?? '').trim().toUpperCase();
}
