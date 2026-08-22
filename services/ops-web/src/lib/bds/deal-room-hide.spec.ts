import { describe, expect, it } from 'vitest';
import { shouldHideDealRoom } from './deal-room-hide';
import type { StoredStaffUser } from '@/lib/auth';

function user(caps: StoredStaffUser['caps']): StoredStaffUser {
  return { id: '1', email: 'u@test.vn', display_name: 'U', position_id: 1, caps };
}

describe('shouldHideDealRoom', () => {
  it('UC-003 re_buyer hides deal room', () => {
    expect(shouldHideDealRoom({ leadFlowKind: 're_buyer', user: user([]) })).toBe(true);
  });

  it('PTT b2b user keeps deal room on spa lead', () => {
    expect(
      shouldHideDealRoom({
        leadFlowKind: 'b2b_prospect',
        user: user([{ section: 'crm_b2b_projects', action: 'view' }]),
      }),
    ).toBe(false);
  });

  it('bds-only user hides deal room', () => {
    expect(
      shouldHideDealRoom({
        leadFlowKind: 'b2b_prospect',
        user: user([{ section: 'bds_buyers', action: 'view' }]),
      }),
    ).toBe(true);
  });
});
