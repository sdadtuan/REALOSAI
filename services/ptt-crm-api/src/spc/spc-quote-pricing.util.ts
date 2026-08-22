import type { QuoteReferencePrice } from '../proposals/quote-pricing.util';

export function resolveQuotePriceFromPricingModel(
  model: Record<string, unknown> | null | undefined,
): QuoteReferencePrice {
  if (!model || typeof model !== 'object') {
    return { min_vnd: 0, max_vnd: 0, suggested_vnd: 0 };
  }
  const type = String(model.type ?? '');
  switch (type) {
    case 'one_time': {
      const min = Number(model.min_vnd) || 0;
      const max = Number(model.max_vnd) || min;
      const suggested = min || Math.round((min + max) / 2);
      return { min_vnd: min, max_vnd: max, suggested_vnd: suggested };
    }
    case 'retainer':
    case 'setup_plus_retainer': {
      const min = Number(model.monthly_min_vnd) || 0;
      const max = Number(model.max_vnd ?? model.monthly_max_vnd) || min;
      const monthlyMax = Number(model.monthly_max_vnd) || max;
      const suggested = min || Math.round((min + monthlyMax) / 2);
      return { min_vnd: min, max_vnd: monthlyMax, suggested_vnd: suggested };
    }
    case 'percent_of_ad_spend': {
      const min = Number(model.min_fee_vnd) || 0;
      return { min_vnd: min, max_vnd: min, suggested_vnd: min };
    }
    default:
      return { min_vnd: 0, max_vnd: 0, suggested_vnd: 0 };
  }
}
