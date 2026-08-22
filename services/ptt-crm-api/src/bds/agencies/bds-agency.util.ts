export function canActivateAgency(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_channel';
}

export function canOverrideTier(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_sales_dir';
}

export function canGrantExclusive(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_sales_dir';
}

export function canHoldAgencyStatus(status: string): boolean {
  return String(status) === 'active';
}

export function assertExclusiveAllowed(
  exclusiveAllowed: boolean,
  exclusivity: string,
): void {
  if (exclusivity === 'exclusive' && exclusiveAllowed !== true) {
    throw { error: 'exclusive_tier' };
  }
}

export function assertHoldQuota(openCount: number, maxConcurrent: number): void {
  if (openCount >= maxConcurrent) {
    throw { error: 'hold_quota' };
  }
}

export function isInhousePool(pool: string): boolean {
  return String(pool) === 'inhouse';
}

export function parentKindAllowsF2(parentKind: string): boolean {
  const k = String(parentKind);
  return k === 'f1' || k === 'tong_dai_ly';
}

export const REVOKE_REASONS = new Set(['rank_drop', 'manual', 'phase_close', 'contract_end']);
