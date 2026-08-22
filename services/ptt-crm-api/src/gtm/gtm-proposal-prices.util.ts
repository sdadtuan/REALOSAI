import type { SkuInterest } from './gtm-validate.util';

export const GTM_PROPOSAL_SKU_PRICES: Record<
  SkuInterest,
  { name: string; retainer: number; setup: number }
> = {
  mkt: { name: 'PTTCRM Marketing', retainer: 4_900_000, setup: 8_000_000 },
  ind: { name: 'PTTCRM Industry', retainer: 9_900_000, setup: 12_000_000 },
  agy: { name: 'PTTCRM Agency OS', retainer: 19_900_000, setup: 20_000_000 },
};
