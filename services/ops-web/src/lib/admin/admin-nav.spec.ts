import { describe, expect, it } from 'vitest';
import {
  buildAdminHubWorkspaces,
  buildAdminNavGroups,
  buildAdminSidebarLinks,
  canViewAdminSection,
} from './admin-nav';
import type { StoredStaffUser } from '@/lib/auth';

function adminUser(overrides: Partial<StoredStaffUser> = {}): StoredStaffUser {
  return {
    id: 'u1',
    email: 'admin@pttads.vn',
    display_name: 'Admin',
    position_id: 1,
    position_code: 'super-admin',
    job_functions: [],
    caps: [
      { section: 'crm_data_config', action: 'view' },
      { section: 'crm_staff_roster', action: 'view' },
      { section: 'ai_admin', action: 'view' },
    ],
    ...overrides,
  };
}

describe('admin-nav', () => {
  it('canViewAdminSection true when any admin cap', () => {
    expect(canViewAdminSection(adminUser())).toBe(true);
    expect(canViewAdminSection(null)).toBe(false);
  });

  it('sidebar exposes single hub link', () => {
    expect(buildAdminSidebarLinks(adminUser())).toEqual([
      { href: '/admin', label: 'Trung tâm quản trị' },
    ]);
  });

  it('nav groups include org users when roster view + WIN_ORG_UI', () => {
    const prev = process.env.NEXT_PUBLIC_WIN_ORG_UI;
    process.env.NEXT_PUBLIC_WIN_ORG_UI = '1';
    const groups = buildAdminNavGroups(adminUser());
    const org = groups.find((g) => g.id === 'org');
    expect(org?.links.some((l) => l.href === '/admin/crm/org/users')).toBe(true);
    process.env.NEXT_PUBLIC_WIN_ORG_UI = prev;
  });

  it('nav groups include permissions when crm_data_config.view', () => {
    const groups = buildAdminNavGroups(adminUser());
    const rbac = groups.find((g) => g.id === 'rbac');
    expect(rbac?.links.some((l) => l.href === '/admin/crm/permissions')).toBe(true);
  });

  it('hub workspaces include AI when ai_admin.view', () => {
    const workspaces = buildAdminHubWorkspaces(adminUser());
    expect(workspaces.some((w) => w.id === 'ai')).toBe(true);
  });

  it('shows Video SOP providers when crm_vd.admin or ai_admin view', () => {
    const href = '/admin/video/providers';
    const ai = adminUser({ caps: [{ section: 'ai_admin', action: 'view' }] });
    const vd = adminUser({ caps: [{ section: 'crm_vd.admin', action: 'view' }] });
    expect(buildAdminNavGroups(ai).find((g) => g.id === 'ai')?.links.some((l) => l.href === href)).toBe(
      true,
    );
    expect(buildAdminNavGroups(vd).find((g) => g.id === 'ai')?.links.some((l) => l.href === href)).toBe(
      true,
    );
    expect(canViewAdminSection(vd)).toBe(true);
  });

  it('empty for user without admin caps', () => {
    const user = adminUser({
      caps: [{ section: 'crm_leads', action: 'view' }],
    });
    expect(canViewAdminSection(user)).toBe(false);
    expect(buildAdminSidebarLinks(user)).toEqual([]);
    expect(buildAdminNavGroups(user)).toEqual([]);
  });
});
