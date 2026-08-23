import { describe, expect, it } from 'vitest';
import {
  isBdsRolePosition,
  resolveBdsRoleLanding,
  resolvePostLoginPath,
  shouldUseBdsPwaHold,
} from './role-landing';

describe('role-landing', () => {
  it('maps 18 CĐT roles to home screens', () => {
    expect(resolveBdsRoleLanding('tvv_inhouse')).toBe('/crm/bds/holds');
    expect(resolveBdsRoleLanding('cskh_lead')).toBe('/crm/cskh-board?flow=re_buyer');
    expect(resolveBdsRoleLanding('hr_bp')).toBe('/crm/hr');
    expect(resolveBdsRoleLanding('truong_collection')).toBe('/crm/bds/collections');
  });

  it('broker mode → giỏ sàn', () => {
    expect(resolveBdsRoleLanding('tvv_inhouse', 'broker')).toBe('/crm/bds/basket');
  });

  it('isBdsRolePosition covers seed codes', () => {
    expect(isBdsRolePosition('pm_du_an')).toBe(true);
    expect(isBdsRolePosition('sales')).toBe(false);
  });

  it('resolvePostLoginPath prefers explicit next', () => {
    expect(
      resolvePostLoginPath(
        { position_code: 'tvv_inhouse', caps: [{ section: 'bds_holds', action: 'view' }] } as never,
        'developer',
        '/crm/work',
      ),
    ).toBe('/crm/work');
  });

  it('BDS TVV login → hold list', () => {
    expect(
      resolvePostLoginPath(
        { position_code: 'tvv_inhouse', caps: [{ section: 'bds_holds', action: 'create' }] } as never,
        'developer',
        null,
      ),
    ).toBe('/crm/bds/holds');
  });

  it('TVV mobile + create cap → PWA hold', () => {
    const user = {
      position_code: 'tvv_inhouse',
      caps: [{ section: 'bds_holds', action: 'create' }],
    } as never;
    expect(shouldUseBdsPwaHold(user, true)).toBe(true);
    expect(shouldUseBdsPwaHold(user, false)).toBe(false);
    expect(resolvePostLoginPath(user, 'developer', null, { isMobile: true })).toBe('/crm/bds/pwa');
  });
});
