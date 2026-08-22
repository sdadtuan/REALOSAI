import type { CrmStaffRow, StaffOrgUserSummary } from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { winOrgUiEnabled } from '@/lib/win/flags';

export type StaffLoginRbacStatus = 'active' | 'no_account' | 'inactive';

export type StaffLoginRbacTone = 'success' | 'warning' | 'muted';

export type StaffLoginRbacRow = {
  status: StaffLoginRbacStatus;
  label: string;
  tone: StaffLoginRbacTone;
  orgUser?: StaffOrgUserSummary;
};

export type OrgOnboardDeepLinkParams = {
  email?: string;
  crmStaffId?: number;
  name?: string;
  phone?: string;
  jobTitle?: string;
  internalCode?: string;
};

export function canLinkToOrgAdmin(user: StoredStaffUser | null): boolean {
  if (!user || !winOrgUiEnabled()) return false;
  return (
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_data_config', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  );
}

export function canOnboardFromRoster(user: StoredStaffUser | null): boolean {
  if (!user || !winOrgUiEnabled()) return false;
  return hasCap(user, 'crm_staff_roster', 'edit');
}

export function resolveStaffLoginRbac(
  staff: CrmStaffRow,
  orgUser?: StaffOrgUserSummary | null,
): StaffLoginRbacRow {
  if (!orgUser) {
    return { status: 'no_account', label: 'Chưa có TK', tone: 'warning' };
  }
  if (orgUser.active === false) {
    return { status: 'inactive', label: 'Ngưng', tone: 'muted', orgUser };
  }
  return { status: 'active', label: 'Hoạt động', tone: 'success', orgUser };
}

export function buildOrgUsersDeepLink(email: string): string {
  const params = new URLSearchParams({ email: email.trim() });
  return `/admin/crm/org/users?${params.toString()}`;
}

export function buildOrgOnboardDeepLink(params: OrgOnboardDeepLinkParams): string {
  const qs = new URLSearchParams();
  if (params.email?.trim()) qs.set('email', params.email.trim());
  if (params.crmStaffId != null) qs.set('crm_staff_id', String(params.crmStaffId));
  if (params.name?.trim()) qs.set('name', params.name.trim());
  if (params.phone?.trim()) qs.set('phone', params.phone.trim());
  if (params.jobTitle?.trim()) qs.set('job_title', params.jobTitle.trim());
  if (params.internalCode?.trim()) qs.set('internal_code', params.internalCode.trim());
  return `/admin/crm/org/users/new?${qs.toString()}`;
}

export function staffRosterAdminHref(): string {
  return '/crm/staff?admin=1';
}
