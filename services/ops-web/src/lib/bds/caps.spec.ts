import { describe, expect, it } from 'vitest';
import { canViewBdsProjectHouse, hasAnyBdsCap, hideCommissionSchemePct } from './caps';
import type { StoredStaffUser } from '@/lib/auth';

function user(caps: StoredStaffUser['caps'], job_functions?: string[]): StoredStaffUser {
  return {
    id: '1',
    email: 'u@test.vn',
    display_name: 'U',
    position_id: 1,
    caps: caps ?? [],
    job_functions,
  };
}

describe('bds caps', () => {
  it('hasAnyBdsCap detects bds_*', () => {
    expect(hasAnyBdsCap(user([{ section: 'bds_holds', action: 'view' }]))).toBe(true);
    expect(hasAnyBdsCap(user([{ section: 'crm_leads', action: 'view' }]))).toBe(false);
  });

  it('hideCommissionSchemePct for ctv', () => {
    expect(hideCommissionSchemePct(user([], ['ctv']))).toBe(true);
    expect(hideCommissionSchemePct(user([], ['am']))).toBe(false);
  });

  it('PM / SP / PC house without crm_re_projects', () => {
    expect(canViewBdsProjectHouse(user([{ section: 'bds_project_os', action: 'view' }]))).toBe(true);
    expect(canViewBdsProjectHouse(user([{ section: 'bds_inventory', action: 'view' }]))).toBe(true);
    expect(canViewBdsProjectHouse(user([{ section: 'bds_legal', action: 'view' }]))).toBe(true);
    expect(canViewBdsProjectHouse(user([{ section: 'crm_re_projects', action: 'view' }]))).toBe(true);
    expect(canViewBdsProjectHouse(user([{ section: 'bds_holds', action: 'view' }]))).toBe(false);
  });
});
