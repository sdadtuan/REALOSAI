import type { SkuInterest } from './gtm-validate.util';

/** Master §6.3 USD list prices — setup amounts used for Stripe W2 checkout. */
export const GTM_USD_LIST_PRICE: Record<
  SkuInterest,
  { retainer_usd: number; setup_usd: number }
> = {
  mkt: { retainer_usd: 199, setup_usd: 400 },
  ind: { retainer_usd: 399, setup_usd: 600 },
  agy: { retainer_usd: 799, setup_usd: 1200 },
};

export function setupUsdCents(sku: SkuInterest): number {
  return GTM_USD_LIST_PRICE[sku].setup_usd * 100;
}

export function isSkuInterest(value: string): value is SkuInterest {
  return value === 'mkt' || value === 'ind' || value === 'agy';
}
