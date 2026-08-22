import type { SpcPricingModel, SpcTier } from './spc.types';

const TIER_TO_LEGACY: Record<SpcTier, string> = {
  CB: 'basic',
  TC: 'standard',
  CS: 'premium',
};

export type LegacyTierPricing = Record<
  string,
  { price_vnd: number; min_vnd: number; max_vnd: number }
>;

export function pricingModelToLegacyTier(
  pricing: SpcPricingModel | null | undefined,
): { price_vnd: number; min_vnd: number; max_vnd: number } | null {
  if (!pricing || typeof pricing !== 'object') return null;
  const type = String(pricing.type ?? '');
  switch (type) {
    case 'one_time': {
      const min = Number(pricing.min_vnd) || 0;
      const max = Number(pricing.max_vnd) || min;
      const price = min || Math.round((min + max) / 2);
      return { price_vnd: price, min_vnd: min, max_vnd: max };
    }
    case 'retainer':
    case 'setup_plus_retainer': {
      const min = Number(pricing.monthly_min_vnd) || 0;
      const max = Number(pricing.monthly_max_vnd) || min;
      const price = min || Math.round((min + max) / 2);
      return { price_vnd: price, min_vnd: min, max_vnd: max };
    }
    case 'percent_of_ad_spend': {
      const min = Number(pricing.min_fee_vnd) || 0;
      return { price_vnd: min, min_vnd: min, max_vnd: min };
    }
    default:
      return null;
  }
}

export function buildLegacyTierPricingFromOffers(
  offers: Array<{ tier: SpcTier; pricing_model: SpcPricingModel }>,
): LegacyTierPricing {
  const legacy: LegacyTierPricing = {};
  for (const offer of offers) {
    const key = TIER_TO_LEGACY[offer.tier];
    if (!key) continue;
    const mapped = pricingModelToLegacyTier(offer.pricing_model);
    if (mapped) legacy[key] = mapped;
  }
  return legacy;
}
