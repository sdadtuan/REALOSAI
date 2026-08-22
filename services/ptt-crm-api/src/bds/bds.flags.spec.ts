import { envFlagOn, isBdsPackEnabled, isBdsPgEnabled } from './bds.flags';

describe('bds.flags', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevPg = process.env.PTT_BDS_PG;
  afterEach(() => {
    process.env.PTT_BDS_PACK = prevPack;
    process.env.PTT_BDS_PG = prevPg;
  });

  it('defaults PACK off when unset', () => {
    delete process.env.PTT_BDS_PACK;
    expect(isBdsPackEnabled()).toBe(false);
  });

  it('treats 1/true/yes/on as on', () => {
    process.env.PTT_BDS_PACK = '1';
    expect(isBdsPackEnabled()).toBe(true);
    process.env.PTT_BDS_PG = 'true';
    expect(isBdsPgEnabled()).toBe(true);
  });

  it('envFlagOn is false for 0 and off', () => {
    expect(envFlagOn('0')).toBe(false);
    expect(envFlagOn('off')).toBe(false);
  });
});
