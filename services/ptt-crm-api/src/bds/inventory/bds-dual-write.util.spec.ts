import { assertCountGate, shouldDualWrite } from './bds-dual-write.util';

describe('bds-dual-write', () => {
  const prev = process.env.PTT_BDS_PG;
  afterEach(() => {
    process.env.PTT_BDS_PG = prev;
  });

  it('shouldDualWrite follows PTT_BDS_PG', () => {
    process.env.PTT_BDS_PG = '0';
    expect(shouldDualWrite()).toBe(false);
    process.env.PTT_BDS_PG = '1';
    expect(shouldDualWrite()).toBe(true);
  });

  // P1: same helper for products
  it('assertCountGate throws when counts differ (BDS-20)', () => {
    expect(() => assertCountGate(10, 9)).toThrow(/BDS-20/);
  });

  it('assertCountGate passes when equal', () => {
    expect(() => assertCountGate(3, 3)).not.toThrow();
  });
});
