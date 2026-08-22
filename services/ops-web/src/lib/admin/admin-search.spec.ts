import { describe, expect, it } from 'vitest';
import {
  buildAdminSearchIndex,
  normalizeAdminSearchText,
  parseAdminSearchPrefix,
  searchAdminRoutes,
} from './admin-search';
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

describe('admin-search', () => {
  it('normalizeAdminSearchText strips diacritics', () => {
    expect(normalizeAdminSearchText('Ma trận')).toBe('ma tran');
    expect(normalizeAdminSearchText('Đăng nhập')).toBe('dang nhap');
  });

  it('buildAdminSearchIndex empty without caps', () => {
    expect(
      buildAdminSearchIndex(
        adminUser({ caps: [{ section: 'crm_leads', action: 'view' }] }),
      ),
    ).toEqual([]);
  });

  it('buildAdminSearchIndex includes hub entry', () => {
    const index = buildAdminSearchIndex(adminUser());
    expect(index.some((h) => h.href === '/admin')).toBe(true);
  });

  it('searchAdminRoutes finds onboard with WIN_ORG_UI', () => {
    const prev = process.env.NEXT_PUBLIC_WIN_ORG_UI;
    process.env.NEXT_PUBLIC_WIN_ORG_UI = '1';
    const hits = searchAdminRoutes(adminUser(), 'onboard');
    expect(hits.some((h) => h.href === '/admin/crm/org/users/new')).toBe(true);
    process.env.NEXT_PUBLIC_WIN_ORG_UI = prev;
  });

  it('searchAdminRoutes finds ma tran permissions', () => {
    const hits = searchAdminRoutes(adminUser(), 'ma tran');
    expect(hits[0]?.href).toBe('/admin/crm/permissions');
  });

  it('searchAdminRoutes respects cap gating', () => {
    const hits = searchAdminRoutes(
      adminUser({ caps: [{ section: 'ai_admin', action: 'view' }] }),
      'custom',
    );
    expect(hits.some((h) => h.href.includes('custom-fields'))).toBe(false);
  });

  it('parseAdminSearchPrefix strips admin: and qt:', () => {
    expect(parseAdminSearchPrefix('admin:onboard')).toEqual({
      query: 'onboard',
      adminOnly: true,
    });
    expect(parseAdminSearchPrefix('qt:permissions')).toEqual({
      query: 'permissions',
      adminOnly: true,
    });
    expect(parseAdminSearchPrefix('lead')).toEqual({ query: 'lead', adminOnly: false });
  });
});
