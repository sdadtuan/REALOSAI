import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export const CRM_GDKD_SECTION = 'crm_gdkd';

export type GdkdCapAction = 'override' | 'assign' | 'review_queue' | 'view_all_leads';

/** R2-A — check crm_gdkd.* with legacy crm_leads.assign bridge. */
export function hasGdkdCap(caps: StaffSectionCap[], action: GdkdCapAction): boolean {
  if (caps.some((c) => c.section === CRM_GDKD_SECTION && c.action === action)) {
    return true;
  }
  if (action === 'assign' || action === 'override') {
    return caps.some((c) => c.section === 'crm_leads' && c.action === 'assign');
  }
  return false;
}

export function hasGdkdAssign(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'assign');
}

export function hasGdkdOverride(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'override');
}

export function hasGdkdViewAllLeads(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'view_all_leads');
}

export function hasGdkdReviewQueue(caps: StaffSectionCap[]): boolean {
  return hasGdkdCap(caps, 'review_queue');
}
