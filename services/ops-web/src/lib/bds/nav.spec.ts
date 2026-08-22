import { describe, expect, it, afterEach } from 'vitest';
import { buildBdsNavSections, hubHomeHref } from './nav';
import type { StoredStaffUser } from '@/lib/auth';

function user(caps: StoredStaffUser['caps']): StoredStaffUser {
  return { id: '1', email: 'u@test.vn', display_name: 'U', position_id: 1, caps };
}

describe('buildBdsNavSections', () => {
  const prev = process.env.NEXT_PUBLIC_PTT_BDS_UI;
  afterEach(() => {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_PTT_BDS_UI;
    else process.env.NEXT_PUBLIC_PTT_BDS_UI = prev;
  });

  it('UI off → no BĐS section', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '0';
    expect(buildBdsNavSections(user([{ section: 'bds_tenant', action: 'view' }]), 'developer')).toEqual([]);
  });

  it('CĐT shows hub; hides Deal Room href', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links =
      buildBdsNavSections(
        user([
          { section: 'bds_tenant', action: 'view' },
          { section: 'bds_buyers', action: 'view' },
        ]),
        'developer',
      )[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds')).toBe(true);
    expect(links.some((l) => l.href.includes('deal-room'))).toBe(false);
  });

  it('broker nav has basket, no hub', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    const links = buildBdsNavSections(user([{ section: 'bds_baskets', action: 'view' }]), 'broker')[0]?.links ?? [];
    expect(links.some((l) => l.href === '/crm/bds/basket')).toBe(true);
    expect(links.some((l) => l.href === '/crm/bds')).toBe(false);
  });

  it('PTT user without bds_* → empty', () => {
    process.env.NEXT_PUBLIC_PTT_BDS_UI = '1';
    expect(buildBdsNavSections(user([{ section: 'crm_leads', action: 'view' }]), 'developer')).toEqual([]);
  });
});

describe('hubHomeHref', () => {
  it('broker → basket', () => {
    expect(hubHomeHref('broker')).toBe('/crm/bds/basket');
  });

  it('developer → hub', () => {
    expect(hubHomeHref('developer')).toBe('/crm/bds');
  });
});
