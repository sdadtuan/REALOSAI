import {
  eligibleStaffIdsForLead,
  leadAssignmentPoolKey,
  pickRoundRobinStaffId,
} from './lead-assign-scope.util';
import { normalizeEmail, normalizePhone } from './lead-contact.util';

describe('lead-contact.util', () => {
  it('normalizes VN phone with country code', () => {
    expect(normalizePhone('+84901234567')).toBe('0901234567');
    expect(normalizeEmail('  Test@Example.COM ')).toBe('test@example.com');
  });
});

describe('lead-assign-scope.util', () => {
  it('builds pool key from industry × service', () => {
    expect(leadAssignmentPoolKey('spa', 'lead-gen')).toBe('lead_rr:ind:spa:svc:lead-gen');
  });

  it('filters staff by assign scope wildcard', () => {
    const scopes = [
      { staff_id: 1, industry_slug: 'spa', service_slug: '*', active: true },
      { staff_id: 2, industry_slug: 'fnb', service_slug: '*', active: true },
    ];
    const ids = eligibleStaffIdsForLead(scopes, 'spa', 'lead-gen');
    expect(ids).not.toBeNull();
    expect([...ids!]).toEqual([1]);
  });

  it('round-robin rotates within pool', () => {
    const state = [{ pool_key: 'lead_rr:ind:spa:svc:lead-gen', last_staff_id: 2 }];
    expect(pickRoundRobinStaffId([1, 2, 3], 'lead_rr:ind:spa:svc:lead-gen', state)).toBe(3);
    expect(pickRoundRobinStaffId([1, 2, 3], 'lead_rr:ind:spa:svc:lead-gen', [])).toBe(1);
  });
});
