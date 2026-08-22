import { GTM_PROPOSAL_SKU_PRICES } from './gtm-proposal-prices.util';

describe('gtm-proposal-prices.util', () => {
  it('maps list price v1 SKU names without RNOSAI', () => {
    expect(GTM_PROPOSAL_SKU_PRICES.agy.name).toBe('PTTCRM Agency OS');
    expect(JSON.stringify(GTM_PROPOSAL_SKU_PRICES)).not.toMatch(/RNOSAI/);
  });
});
