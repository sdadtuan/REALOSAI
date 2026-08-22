import { describe, expect, it } from 'vitest';
import { canAccessPath, hasAnyCap, resolvePathCapRequirements } from '@/lib/rbac-routes';
import { hasCap, type StoredStaffUser } from '@/lib/auth';

function user(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('hasCap (fail-closed R1-S2)', () => {
  it('returns false when user is null', () => {
    expect(hasCap(null, 'crm_leads', 'view')).toBe(false);
  });

  it('returns false when caps array is empty', () => {
    expect(hasCap(user([]), 'crm_leads', 'view')).toBe(false);
  });

  it('returns false when caps is missing', () => {
    expect(hasCap({ id: '1', email: 'a', display_name: 'A', position_id: 1 }, 'crm_leads', 'view')).toBe(
      false,
    );
  });

  it('returns true when cap exists', () => {
    expect(hasCap(user([{ section: 'crm_leads', action: 'view' }]), 'crm_leads', 'view')).toBe(true);
  });

  it('returns false for wrong action (KD-01 presales view only)', () => {
    const kd = user([{ section: 'crm_presales_solution', action: 'view' }]);
    expect(hasCap(kd, 'crm_presales_solution', 'view')).toBe(true);
    expect(hasCap(kd, 'crm_presales_solution', 'claim')).toBe(false);
  });
});

describe('rbac-routes', () => {
  it('KD-01 can open leads but not solution claim route without cap', () => {
    const kd = user([
      { section: 'crm_leads', action: 'view' },
      { section: 'crm_presales_solution', action: 'view' },
    ]);
    expect(canAccessPath('/crm/b2b/leads', kd, 'crm')).toBe(true);
    expect(canAccessPath('/crm/solution/queue', kd, 'crm')).toBe(true);
    expect(hasCap(kd, 'crm_presales_solution', 'claim')).toBe(false);
  });

  it('MKT-01 can access solution queue', () => {
    const mkt = user([
      { section: 'crm_presales_solution', action: 'view' },
      { section: 'crm_presales_solution', action: 'claim' },
    ]);
    expect(canAccessPath('/crm/solution/queue', mkt, 'crm')).toBe(true);
  });

  it('empty caps cannot access /crm', () => {
    expect(canAccessPath('/crm/leads', user([]), 'crm')).toBe(false);
  });

  it('seo zone requires seo or agency view', () => {
    expect(canAccessPath('/seo/hub', user([{ section: 'crm_seo_aeo', action: 'view' }]), 'seo')).toBe(
      true,
    );
    expect(canAccessPath('/seo/hub', user([{ section: 'crm_leads', action: 'view' }]), 'seo')).toBe(
      false,
    );
  });

  it('email zone requires email or agency view', () => {
    expect(
      canAccessPath('/email/hub', user([{ section: 'crm_email_mkt', action: 'view' }]), 'email'),
    ).toBe(true);
  });

  it('resolvePathCapRequirements prefers longer prefix', () => {
    const reqs = resolvePathCapRequirements('/crm/solution/queue', 'crm');
    expect(reqs.some((r) => r.section === 'crm_presales_solution')).toBe(true);
  });

  it('/crm/video requires crm_vd.project or crm_content view', () => {
    const vd = user([{ section: 'crm_vd.project', action: 'view' }]);
    const content = user([{ section: 'crm_content', action: 'view' }]);
    const leadsOnly = user([{ section: 'crm_leads', action: 'view' }]);
    expect(canAccessPath('/crm/video', vd, 'crm')).toBe(true);
    expect(canAccessPath('/crm/video/7', content, 'crm')).toBe(true);
    expect(canAccessPath('/crm/video', leadsOnly, 'crm')).toBe(false);
    const reqs = resolvePathCapRequirements('/crm/video/7', 'crm');
    expect(reqs).toEqual([
      { section: 'crm_vd.project', action: 'view' },
      { section: 'crm_content', action: 'view' },
    ]);
  });

  it('hasAnyCap aggregates requirements', () => {
    expect(
      hasAnyCap(user([{ section: 'crm_agency', action: 'view' }]), [
        { section: 'crm_email_mkt', action: 'view' },
        { section: 'crm_agency', action: 'view' },
      ]),
    ).toBe(true);
  });
});
