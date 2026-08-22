import {
  envFlagOn,
  isBdsHoldTtlEnabled,
  isBdsPackEnabled,
  isBdsPgEnabled,
  isBdsPolicyEnabled,
  isBdsProjectOsEnabled,
} from './bds.flags';

describe('bds.flags', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevPg = process.env.PTT_BDS_PG;
  const prevProjectOs = process.env.PTT_BDS_PROJECT_OS;
  const prevHoldTtl = process.env.PTT_BDS_HOLD_TTL;
  const prevPolicy = process.env.PTT_BDS_POLICY;
  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevPg === undefined) delete process.env.PTT_BDS_PG;
    else process.env.PTT_BDS_PG = prevPg;
    if (prevProjectOs === undefined) delete process.env.PTT_BDS_PROJECT_OS;
    else process.env.PTT_BDS_PROJECT_OS = prevProjectOs;
    if (prevHoldTtl === undefined) delete process.env.PTT_BDS_HOLD_TTL;
    else process.env.PTT_BDS_HOLD_TTL = prevHoldTtl;
    if (prevPolicy === undefined) delete process.env.PTT_BDS_POLICY;
    else process.env.PTT_BDS_POLICY = prevPolicy;
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

  it('defaults PROJECT_OS off when unset', () => {
    delete process.env.PTT_BDS_PROJECT_OS;
    expect(isBdsProjectOsEnabled()).toBe(false);
  });

  it('PROJECT_OS on for 1', () => {
    process.env.PTT_BDS_PROJECT_OS = '1';
    expect(isBdsProjectOsEnabled()).toBe(true);
  });

  it('defaults HOLD_TTL off when unset', () => {
    delete process.env.PTT_BDS_HOLD_TTL;
    expect(isBdsHoldTtlEnabled()).toBe(false);
  });

  it('HOLD_TTL on for 1', () => {
    process.env.PTT_BDS_HOLD_TTL = '1';
    expect(isBdsHoldTtlEnabled()).toBe(true);
  });

  it('defaults POLICY off when unset', () => {
    delete process.env.PTT_BDS_POLICY;
    expect(isBdsPolicyEnabled()).toBe(false);
  });

  it('POLICY on for 1', () => {
    process.env.PTT_BDS_POLICY = '1';
    expect(isBdsPolicyEnabled()).toBe(true);
  });
});
