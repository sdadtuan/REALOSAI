import {
  envFlagOn,
  isBdsHoldTtlEnabled,
  isBdsPackEnabled,
  isBdsPgEnabled,
  isBdsPolicyEnabled,
  isBdsProjectOsEnabled,
  isBdsTxEnabled,
  isBdsAgencyEnabled,
  isBdsCollectionEnabled,
  isBdsBuyerEnabled,
  isBdsCommissionEnabled,
  isBdsCapiEnabled,
  isBdsUiEnabled,
  isBdsNavHideB2bEnabled,
  isBdsAftersalesEnabled,
  isBdsLaunchEnabled,
} from './bds.flags';

describe('bds.flags', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevPg = process.env.PTT_BDS_PG;
  const prevProjectOs = process.env.PTT_BDS_PROJECT_OS;
  const prevHoldTtl = process.env.PTT_BDS_HOLD_TTL;
  const prevPolicy = process.env.PTT_BDS_POLICY;
  const prevTx = process.env.PTT_BDS_TX;
  const prevAgency = process.env.PTT_BDS_AGENCY;
  const prevCollection = process.env.PTT_BDS_COLLECTION;
  const prevBuyer = process.env.PTT_BDS_BUYER;
  const prevCommission = process.env.PTT_BDS_COMMISSION;
  const prevCapi = process.env.PTT_BDS_CAPI;
  const prevUi = process.env.PTT_BDS_UI;
  const prevAftersales = process.env.PTT_BDS_AFTERSALES;
  const prevLaunch = process.env.PTT_BDS_LAUNCH;
  const prevNavHideB2b = process.env.PTT_BDS_NAV_HIDE_B2B;
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
    if (prevTx === undefined) delete process.env.PTT_BDS_TX;
    else process.env.PTT_BDS_TX = prevTx;
    if (prevAgency === undefined) delete process.env.PTT_BDS_AGENCY;
    else process.env.PTT_BDS_AGENCY = prevAgency;
    if (prevCollection === undefined) delete process.env.PTT_BDS_COLLECTION;
    else process.env.PTT_BDS_COLLECTION = prevCollection;
    if (prevBuyer === undefined) delete process.env.PTT_BDS_BUYER;
    else process.env.PTT_BDS_BUYER = prevBuyer;
    if (prevCommission === undefined) delete process.env.PTT_BDS_COMMISSION;
    else process.env.PTT_BDS_COMMISSION = prevCommission;
    if (prevCapi === undefined) delete process.env.PTT_BDS_CAPI;
    else process.env.PTT_BDS_CAPI = prevCapi;
    if (prevUi === undefined) delete process.env.PTT_BDS_UI;
    else process.env.PTT_BDS_UI = prevUi;
    if (prevAftersales === undefined) delete process.env.PTT_BDS_AFTERSALES;
    else process.env.PTT_BDS_AFTERSALES = prevAftersales;
    if (prevLaunch === undefined) delete process.env.PTT_BDS_LAUNCH;
    else process.env.PTT_BDS_LAUNCH = prevLaunch;
    if (prevNavHideB2b === undefined) delete process.env.PTT_BDS_NAV_HIDE_B2B;
    else process.env.PTT_BDS_NAV_HIDE_B2B = prevNavHideB2b;
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

  it('defaults TX off when unset', () => {
    delete process.env.PTT_BDS_TX;
    expect(isBdsTxEnabled()).toBe(false);
  });

  it('TX on for 1', () => {
    process.env.PTT_BDS_TX = '1';
    expect(isBdsTxEnabled()).toBe(true);
  });

  it('defaults AGENCY off when unset', () => {
    delete process.env.PTT_BDS_AGENCY;
    expect(isBdsAgencyEnabled()).toBe(false);
  });

  it('AGENCY on for 1', () => {
    process.env.PTT_BDS_AGENCY = '1';
    expect(isBdsAgencyEnabled()).toBe(true);
  });

  it('defaults COLLECTION off when unset', () => {
    delete process.env.PTT_BDS_COLLECTION;
    expect(isBdsCollectionEnabled()).toBe(false);
  });

  it('COLLECTION on for 1', () => {
    process.env.PTT_BDS_COLLECTION = '1';
    expect(isBdsCollectionEnabled()).toBe(true);
  });

  it('defaults BUYER off when unset', () => {
    delete process.env.PTT_BDS_BUYER;
    expect(isBdsBuyerEnabled()).toBe(false);
  });

  it('BUYER on for 1', () => {
    process.env.PTT_BDS_BUYER = '1';
    expect(isBdsBuyerEnabled()).toBe(true);
  });

  it('defaults COMMISSION off when unset', () => {
    delete process.env.PTT_BDS_COMMISSION;
    expect(isBdsCommissionEnabled()).toBe(false);
  });

  it('defaults CAPI off when unset', () => {
    delete process.env.PTT_BDS_CAPI;
    expect(isBdsCapiEnabled()).toBe(false);
  });

  it('defaults UI off when unset', () => {
    delete process.env.PTT_BDS_UI;
    expect(isBdsUiEnabled()).toBe(false);
  });

  it('defaults AFTERSALES off when unset', () => {
    delete process.env.PTT_BDS_AFTERSALES;
    expect(isBdsAftersalesEnabled()).toBe(false);
  });

  it('AFTERSALES on for 1', () => {
    process.env.PTT_BDS_AFTERSALES = '1';
    expect(isBdsAftersalesEnabled()).toBe(true);
  });

  it('defaults LAUNCH off when unset', () => {
    delete process.env.PTT_BDS_LAUNCH;
    expect(isBdsLaunchEnabled()).toBe(false);
  });

  it('LAUNCH on for 1', () => {
    process.env.PTT_BDS_LAUNCH = '1';
    expect(isBdsLaunchEnabled()).toBe(true);
  });

  it('defaults NAV_HIDE_B2B off when unset', () => {
    delete process.env.PTT_BDS_NAV_HIDE_B2B;
    expect(isBdsNavHideB2bEnabled()).toBe(false);
  });

  it('NAV_HIDE_B2B on for 1', () => {
    process.env.PTT_BDS_NAV_HIDE_B2B = '1';
    expect(isBdsNavHideB2bEnabled()).toBe(true);
  });
});
