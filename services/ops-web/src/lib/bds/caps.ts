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

export function canViewBdsProjectHouse(user: StoredStaffUser | null): boolean {
  return (
    hasCap(user, 'crm_re_projects', 'view') ||
    hasCap(user, 'crm_re_projects_products', 'view') ||
    hasCap(user, 'bds_project_os', 'view') ||
    hasCap(user, 'bds_inventory', 'view') ||
    hasCap(user, 'bds_legal', 'view')
  );
}
