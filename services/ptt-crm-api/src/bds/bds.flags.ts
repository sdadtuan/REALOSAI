const ON = new Set(['1', 'true', 'yes', 'on']);

export function envFlagOn(raw: string | undefined): boolean {
  return ON.has(String(raw ?? '0').trim().toLowerCase());
}

export function isBdsPackEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PACK);
}

export function isBdsPgEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PG);
}

export function isBdsProjectOsEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_PROJECT_OS);
}

export function isBdsHoldTtlEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_HOLD_TTL);
}

export function isBdsPolicyEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_POLICY);
}

export function isBdsTxEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_TX);
}

export function isBdsAgencyEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_AGENCY);
}

export function isBdsCollectionEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_COLLECTION);
}

export function isBdsBuyerEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_BUYER);
}

export function isBdsCommissionEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_COMMISSION);
}

export function isBdsCapiEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_CAPI);
}

export function bdsCapiPurchaseAt(): 'deposit' | 'contracted' {
  const raw = String(process.env.PTT_BDS_CAPI_PURCHASE_AT ?? 'deposit').trim().toLowerCase();
  return raw === 'contracted' ? 'contracted' : 'deposit';
}

export function bdsCapiClientId(): string {
  return String(process.env.PTT_BDS_CAPI_CLIENT_ID ?? '').trim();
}

export function isBdsUiEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_UI);
}

export function isBdsNavHideB2bEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_NAV_HIDE_B2B);
}

export function isBdsAftersalesEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_AFTERSALES);
}

export function isBdsLaunchEnabled(): boolean {
  return envFlagOn(process.env.PTT_BDS_LAUNCH);
}
