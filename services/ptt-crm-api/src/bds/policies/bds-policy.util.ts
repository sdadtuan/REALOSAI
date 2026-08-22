import type { FeeUnit, VatMode } from './bds-policy.types';

export function canActivatePolicy(actorRole: string): boolean {
  return String(actorRole ?? '').trim() === 'cdt_sales_dir';
}

export function assertDiscountAllowed(
  capPct: number,
  requestedPct: number,
  approved: boolean,
): void {
  if (requestedPct > capPct && approved !== true) {
    throw { error: 'discount_cap' };
  }
}

export function computeNetFromCsBh(listVnd: number, discountPct: number): number {
  return Math.round(listVnd * (1 - discountPct / 100));
}

export function assertOnePrice(
  onePrice: boolean,
  listVnd: number,
  discountPct: number,
  netVnd: number,
): void {
  if (!onePrice) return;
  if (netVnd !== computeNetFromCsBh(listVnd, discountPct)) {
    throw { error: 'one_price' };
  }
}

export function netAfterVat(grossVnd: number, vatMode: VatMode): number {
  if (vatMode === 'excluded') return Math.round(grossVnd / 1.1);
  return grossVnd;
}

export function maintenanceFeeTotal(
  feeVnd: number,
  feeUnit: FeeUnit,
  areaM2: number,
): number {
  return feeUnit === 'per_m2' ? Math.round(feeVnd * areaM2) : feeVnd;
}
