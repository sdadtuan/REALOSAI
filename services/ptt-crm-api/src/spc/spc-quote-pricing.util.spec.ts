import { resolveQuotePriceFromPricingModel } from './spc-quote-pricing.util';

describe('spc-quote-pricing.util', () => {
  it('resolves setup_plus_retainer monthly range', () => {
    const out = resolveQuotePriceFromPricingModel({
      type: 'setup_plus_retainer',
      monthly_min_vnd: 8_000_000,
      monthly_max_vnd: 15_000_000,
    });
    expect(out).toEqual({ min_vnd: 8_000_000, max_vnd: 15_000_000, suggested_vnd: 8_000_000 });
  });

  it('resolves one_time range', () => {
    const out = resolveQuotePriceFromPricingModel({
      type: 'one_time',
      min_vnd: 10_000_000,
      max_vnd: 20_000_000,
    });
    expect(out.suggested_vnd).toBe(10_000_000);
  });
});
