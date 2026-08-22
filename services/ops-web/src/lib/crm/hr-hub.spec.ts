import { describe, expect, it } from 'vitest';
import { buildHrHubGroups } from './hr-hub';
import type { StoredStaffUser } from '@/lib/auth';

const hrAdmin: StoredStaffUser = {
  id: 'u1',
  email: 'hr@pttads.vn',
  display_name: 'HR',
  position_id: 1,
  caps: [
    { section: 'crm_data_config', action: 'view' },
    { section: 'crm_staff_roster', action: 'view' },
  ],
};

describe('hr-hub identity cards', () => {
  it('org-users card is linked when WIN_ORG_UI enabled', () => {
    const prev = process.env.NEXT_PUBLIC_WIN_ORG_UI;
    process.env.NEXT_PUBLIC_WIN_ORG_UI = '1';
    const groups = buildHrHubGroups(hrAdmin);
    const identity = groups.find((g) => g.id === 'identity');
    const orgUsers = identity?.cards.find((c) => c.id === 'org-users');
    expect(orgUsers?.planned).toBeFalsy();
    expect(orgUsers?.href).toBe('/admin/crm/org/users');
    process.env.NEXT_PUBLIC_WIN_ORG_UI = prev;
  });

  it('permissions-functions card is linked not planned', () => {
    const groups = buildHrHubGroups(hrAdmin);
    const identity = groups.find((g) => g.id === 'identity');
    const fn = identity?.cards.find((c) => c.id === 'permissions-functions');
    expect(fn?.planned).toBeFalsy();
    expect(fn?.href).toBe('/admin/crm/permissions/functions');
  });
});
