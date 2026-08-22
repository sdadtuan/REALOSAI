import { describe, expect, it } from 'vitest';
import { hasAnyBdsCap, hideCommissionSchemePct } from './caps';
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
});
