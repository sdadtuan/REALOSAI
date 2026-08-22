import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function hasAnyBdsCap(user: StoredStaffUser | null): boolean {
  return Boolean(user?.caps?.some((c) => String(c.section).startsWith('bds_')));
}

export function hideCommissionSchemePct(user: StoredStaffUser | null): boolean {
  const fns = user?.job_functions ?? [];
  return fns.includes('ctv');
}

export function canViewBdsSection(user: StoredStaffUser | null): boolean {
  return hasAnyBdsCap(user);
}

export function canViewBdsHub(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'bds_tenant', 'view') || hasAnyBdsCap(user);
}
