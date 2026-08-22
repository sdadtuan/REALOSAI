import { normalizeQuoteTier, resolveTierPricing } from './quote-pricing.util';

describe('quote-pricing.util', () => {
  it('normalizeQuoteTier maps legacy keys', () => {
    expect(normalizeQuoteTier('TieuChuan')).toBe('standard');
    expect(normalizeQuoteTier('premium')).toBe('premium');
  });

  it('resolveTierPricing reads tier_pricing JSON', () => {
    const ref = resolveTierPricing(
      {
        standard: { price_vnd: 25000000, min_vnd: 20000000, max_vnd: 30000000 },
      },
      'standard',
    );
    expect(ref.suggested_vnd).toBe(25000000);
    expect(ref.min_vnd).toBe(20000000);
  });
});
