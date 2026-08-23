import { assertCountGate, shouldDualWrite } from './bds-dual-write.util';

describe('bds-dual-write', () => {
  const prevPg = process.env.PTT_BDS_PG;
  const prevPack = process.env.PTT_BDS_PACK;
  afterEach(() => {
    if (prevPg === undefined) delete process.env.PTT_BDS_PG;
    else process.env.PTT_BDS_PG = prevPg;
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
  });

  it('shouldDualWrite follows PTT_BDS_PG when not PG-primary', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_PG = '0';
    expect(shouldDualWrite()).toBe(false);
    process.env.PTT_BDS_PG = '1';
    expect(shouldDualWrite()).toBe(true);
  });

  it('PG-primary disables dual-write', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_PG = '1';
    expect(shouldDualWrite()).toBe(false);
  });

  // P1: same helper for products
  it('assertCountGate throws when counts differ (BDS-20)', () => {
    expect(() => assertCountGate(10, 9)).toThrow(/BDS-20/);
  });

  it('assertCountGate passes when equal', () => {
    expect(() => assertCountGate(3, 3)).not.toThrow();
  });
});
