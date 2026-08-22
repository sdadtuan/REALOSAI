import type { StaffSectionCap } from '../staff-auth/staff-auth.types';
import {
  hasGdkdAssign,
  hasGdkdCap,
  hasGdkdOverride,
  hasGdkdViewAllLeads,
} from './staff-gdkd.util';

describe('staff-gdkd.util', () => {
  const legacyGdkd: StaffSectionCap[] = [{ section: 'crm_leads', action: 'assign' }];
  const modernGdkd: StaffSectionCap[] = [{ section: 'crm_gdkd', action: 'assign' }];

  it('hasGdkdAssign accepts crm_gdkd.assign', () => {
    expect(hasGdkdAssign(modernGdkd)).toBe(true);
  });

  it('hasGdkdAssign bridges legacy crm_leads.assign', () => {
    expect(hasGdkdAssign(legacyGdkd)).toBe(true);
  });

  it('hasGdkdOverride bridges legacy assign', () => {
    expect(hasGdkdOverride(legacyGdkd)).toBe(true);
  });

  it('hasGdkdViewAllLeads requires explicit cap', () => {
    expect(hasGdkdViewAllLeads(legacyGdkd)).toBe(false);
    expect(hasGdkdViewAllLeads([{ section: 'crm_gdkd', action: 'view_all_leads' }])).toBe(true);
  });

  it('hasGdkdCap resolves review_queue only on crm_gdkd section', () => {
    expect(hasGdkdCap(legacyGdkd, 'review_queue')).toBe(false);
    expect(hasGdkdCap([{ section: 'crm_gdkd', action: 'review_queue' }], 'review_queue')).toBe(true);
  });
});
