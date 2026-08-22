import { buildLegacyTierPricingFromOffers, pricingModelToLegacyTier } from './spc-pricing-sync.util';

describe('spc-pricing-sync.util', () => {
  it('maps setup_plus_retainer monthly range', () => {
    const out = pricingModelToLegacyTier({
      type: 'setup_plus_retainer',
      setup_min_vnd: 15_000_000,
      setup_max_vnd: 25_000_000,
      monthly_min_vnd: 8_000_000,
      monthly_max_vnd: 15_000_000,
    });
    expect(out).toEqual({ price_vnd: 8_000_000, min_vnd: 8_000_000, max_vnd: 15_000_000 });
  });

  it('builds legacy tier map from offers', () => {
    const legacy = buildLegacyTierPricingFromOffers([
      {
        tier: 'TC',
        pricing_model: { type: 'retainer', monthly_min_vnd: 10_000_000, monthly_max_vnd: 12_000_000 },
      },
    ]);
    expect(legacy.standard).toEqual({ price_vnd: 10_000_000, min_vnd: 10_000_000, max_vnd: 12_000_000 });
  });
});
