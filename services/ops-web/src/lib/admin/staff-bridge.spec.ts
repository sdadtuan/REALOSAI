import { describe, expect, it } from 'vitest';
import {
  buildOrgOnboardDeepLink,
  buildOrgUsersDeepLink,
  resolveStaffLoginRbac,
} from './staff-bridge';
import type { CrmStaffRow, StaffOrgUserSummary } from '@/lib/api';

const staff: CrmStaffRow = {
  id: 42,
  name: 'Nguyen Van A',
  email: 'a@pttads.vn',
  internal_code: 'NV001',
  phone: '090',
  job_title: 'AM',
  department: 'Sales',
  active: 1,
};

const orgUser: StaffOrgUserSummary = {
  id: 'u1',
  email: 'a@pttads.vn',
  display_name: 'Nguyen Van A',
  position_id: 1,
  position_code: 'KD-01',
  active: true,
  job_functions: ['sales'],
};

describe('staff-bridge', () => {
  it('resolveStaffLoginRbac no_account', () => {
    expect(resolveStaffLoginRbac(staff)).toEqual({
      status: 'no_account',
      label: 'Chưa có TK',
      tone: 'warning',
    });
  });

  it('resolveStaffLoginRbac inactive', () => {
    expect(resolveStaffLoginRbac(staff, { ...orgUser, active: false })).toMatchObject({
      status: 'inactive',
      label: 'Ngưng',
      tone: 'muted',
    });
  });

  it('resolveStaffLoginRbac active', () => {
    expect(resolveStaffLoginRbac(staff, orgUser)).toMatchObject({
      status: 'active',
      label: 'Hoạt động',
      tone: 'success',
    });
  });

  it('buildOrgUsersDeepLink encodes email', () => {
    expect(buildOrgUsersDeepLink('a@pttads.vn')).toBe(
      '/admin/crm/org/users?email=a%40pttads.vn',
    );
  });

  it('buildOrgOnboardDeepLink encodes params', () => {
    const href = buildOrgOnboardDeepLink({
      email: 'a@pttads.vn',
      crmStaffId: 42,
      name: 'Nguyen Van A',
    });
    expect(href).toContain('email=a%40pttads.vn');
    expect(href).toContain('crm_staff_id=42');
    expect(href).toContain('name=');
  });
});
