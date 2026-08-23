import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';
import { hasAnyBdsCap } from './caps';
import { hubHomeHref, type BdsTenantMode } from './nav';

export const BDS_ROLE_POSITION_CODES = [
  'tgd',
  'gdkd',
  'pm_du_an',
  'truong_sp',
  'cv_gia',
  'truong_inhouse',
  'tvv_inhouse',
  'truong_kenh',
  'am_kenh',
  'cskh_lead',
  'truong_mkt',
  'truong_pc',
  'cv_hd',
  'truong_collection',
  'cv_hh',
  'truong_after',
  'cv_ban_giao',
  'hr_bp',
] as const;

export type BdsRolePositionCode = (typeof BDS_ROLE_POSITION_CODES)[number];

const DEVELOPER_LANDING: Record<BdsRolePositionCode, string> = {
  tgd: '/crm/bds',
  gdkd: '/crm/bds',
  pm_du_an: '/crm/re-projects',
  truong_sp: '/crm/re-projects',
  cv_gia: '/crm/bds/policies',
  truong_inhouse: '/crm/bds/holds',
  tvv_inhouse: '/crm/bds/holds',
  truong_kenh: '/crm/bds/agencies',
  am_kenh: '/crm/bds/holds',
  cskh_lead: '/crm/cskh-board?flow=re_buyer',
  truong_mkt: '/crm/re-projects',
  truong_pc: '/crm/re-projects',
  cv_hd: '/crm/bds/transactions',
  truong_collection: '/crm/bds/collections',
  cv_hh: '/crm/bds/commissions',
  truong_after: '/crm/bds/aftersales',
  cv_ban_giao: '/crm/bds/aftersales',
  hr_bp: '/crm/hr',
};

export function resolveBdsRoleLanding(
  positionCode: string | undefined | null,
  mode: BdsTenantMode = 'developer',
): string | null {
  if (mode === 'broker') return '/crm/bds/basket';
  const code = String(positionCode ?? '').trim() as BdsRolePositionCode;
  return DEVELOPER_LANDING[code] ?? null;
}

export function isBdsRolePosition(positionCode: string | undefined | null): boolean {
  const code = String(positionCode ?? '').trim();
  return (BDS_ROLE_POSITION_CODES as readonly string[]).includes(code);
}

export function shouldUseBdsPwaHold(user: StoredStaffUser, isMobile: boolean): boolean {
  return (
    isMobile &&
    user.position_code === 'tvv_inhouse' &&
    hasCap(user, 'bds_holds', 'create')
  );
}

export function resolvePostLoginPath(
  user: StoredStaffUser,
  mode: BdsTenantMode,
  nextPath?: string | null,
  opts?: { isMobile?: boolean },
): string {
  if (nextPath && nextPath.startsWith('/')) return nextPath;
  if (user.position_code === 'sandbox_visitor') return '/sandbox/leads';
  if (shouldUseBdsPwaHold(user, opts?.isMobile ?? false)) return '/crm/bds/pwa';
  if (hasAnyBdsCap(user) && isBdsRolePosition(user.position_code)) {
    const landing = resolveBdsRoleLanding(user.position_code, mode);
    if (landing) return landing;
  }
  if (hasAnyBdsCap(user)) return hubHomeHref(mode);
  if (hasCap(user, 'crm_staff_roster', 'view') || hasCap(user, 'crm_hr_docs', 'view')) {
    return '/crm/hr';
  }
  return '/';
}
