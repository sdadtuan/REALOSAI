import { hasCap, type StoredStaffUser } from '@/lib/auth';

export function canViewGtmDemos(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'gtm_demos', 'view') || hasCap(user, 'crm_leads', 'view');
}

export function canWriteGtmDemos(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'gtm_demos', 'write');
}

export function canGrantGtmSandbox(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'gtm.sandbox', 'grant') || hasCap(user, 'gtm_demos', 'write');
}

export function canExportGtmDemos(user: StoredStaffUser | null): boolean {
  return canViewGtmDemos(user);
}

export function canViewGtmCms(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'gtm.cms', 'view');
}

export function canWriteGtmCms(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'gtm.cms', 'write');
}

export function canPublishGtmCms(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'gtm.cms', 'publish');
}

export type GtmSlaTone = 'none' | 'warn' | 'danger';

export function slaBadgeClass(tone: GtmSlaTone): string {
  if (tone === 'danger') return 'badge badge-danger';
  if (tone === 'warn') return 'badge badge-warn';
  return 'badge';
}

export function slaBadgeLabel(tone: GtmSlaTone): string {
  if (tone === 'danger') return 'SLA >4h';
  if (tone === 'warn') return 'SLA >2h';
  return '';
}
