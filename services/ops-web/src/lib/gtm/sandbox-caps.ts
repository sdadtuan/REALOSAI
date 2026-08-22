import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { canGrantSandbox as canGrantSandboxStatus } from './sandbox-status';

export function canGrantSandbox(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'gtm.sandbox', 'grant');
}

export function canGrantSandboxRow(
  user: StoredStaffUser | null,
  status: string,
): boolean {
  return canGrantSandbox(user) && canGrantSandboxStatus(status);
}

export function canExportGtmDemos(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return hasCap(user, 'gtm.demos', 'export') || hasCap(user, 'gtm_demos', 'view');
}

export function canImportGtmDemos(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'gtm_demos', 'write');
}
