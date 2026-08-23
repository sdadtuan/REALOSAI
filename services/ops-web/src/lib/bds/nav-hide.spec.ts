import { describe, expect, it } from 'vitest';
import { filterB2bNavLinks, isB2bNavHref, shouldHideB2bNav } from './nav-hide';

describe('shouldHideB2bNav', () => {
  it('developer + flag → hide', () => {
    expect(shouldHideB2bNav('developer', true)).toBe(true);
  });

  it('hybrid + flag → hide', () => {
    expect(shouldHideB2bNav('hybrid', true)).toBe(true);
  });

  it('broker + flag → keep', () => {
    expect(shouldHideB2bNav('broker', true)).toBe(false);
  });

  it('developer + flag off → keep', () => {
    expect(shouldHideB2bNav('developer', false)).toBe(false);
  });

  it('null mode → keep', () => {
    expect(shouldHideB2bNav(null, true)).toBe(false);
  });
});

describe('isB2bNavHref', () => {
  it('matches sales and nested services', () => {
    expect(isB2bNavHref('/crm/sales')).toBe(true);
    expect(isB2bNavHref('/crm/sales/services')).toBe(true);
  });

  it('matches b2b leads but not unrelated /crm/bds', () => {
    expect(isB2bNavHref('/crm/b2b/leads')).toBe(true);
    expect(isB2bNavHref('/crm/b2b-inbox')).toBe(true);
    expect(isB2bNavHref('/crm/gdkd-enterprise')).toBe(true);
    expect(isB2bNavHref('/crm/cskh-board')).toBe(false);
    expect(isB2bNavHref('/crm/cskh-board?flow=re_buyer')).toBe(false);
    expect(isB2bNavHref('/crm/bds')).toBe(false);
    expect(isB2bNavHref('/crm/leads')).toBe(false);
  });
});

describe('filterB2bNavLinks', () => {
  it('drops B2B hrefs when hide', () => {
    const out = filterB2bNavLinks(
      [
        { href: '/crm/sales', label: 'Kinh doanh' },
        { href: '/crm/cskh-board', label: 'Bảng CSKH SLA' },
      ],
      true,
    );
    expect(out.map((x) => x.href)).toEqual(['/crm/cskh-board']);
  });
});
