import {
  assertDiscountAllowed,
  assertOnePrice,
  canActivatePolicy,
  computeNetFromCsBh,
  maintenanceFeeTotal,
  netAfterVat,
} from './bds-policy.util';

describe('bds-policy.util', () => {
  it('only cdt_sales_dir can activate', () => {
    expect(canActivatePolicy('cdt_sales_dir')).toBe(true);
    expect(canActivatePolicy('cv_gia')).toBe(false);
    expect(canActivatePolicy('')).toBe(false);
    expect(canActivatePolicy('  gdkd  ')).toBe(false);
  });

  it('BDS-12 discount over cap without approval throws discount_cap', () => {
    expect(() => assertDiscountAllowed(5, 8, false)).toThrow(
      expect.objectContaining({ error: 'discount_cap' }),
    );
  });

  it('discount at or under cap ok', () => {
    expect(() => assertDiscountAllowed(5, 5, false)).not.toThrow();
    expect(() => assertDiscountAllowed(5, 3, false)).not.toThrow();
  });

  it('discount over cap with approval ok', () => {
    expect(() => assertDiscountAllowed(5, 8, true)).not.toThrow();
  });

  it('computeNetFromCsBh rounds', () => {
    expect(computeNetFromCsBh(1_000_000_000, 5)).toBe(950_000_000);
  });

  it('assertOnePrice throws when project one_price and net mismatches', () => {
    expect(() => assertOnePrice(true, 100, 10, 95)).toThrow(
      expect.objectContaining({ error: 'one_price' }),
    );
    expect(() => assertOnePrice(true, 100, 10, 90)).not.toThrow();
    expect(() => assertOnePrice(false, 100, 10, 99)).not.toThrow();
  });

  it('vat excluded strips 10%', () => {
    expect(netAfterVat(110, 'excluded')).toBe(100);
    expect(netAfterVat(110, 'included')).toBe(110);
  });

  it('maintenance per_m2', () => {
    expect(maintenanceFeeTotal(100_000, 'per_m2', 50)).toBe(5_000_000);
    expect(maintenanceFeeTotal(2_000_000, 'per_unit', 50)).toBe(2_000_000);
  });
});
