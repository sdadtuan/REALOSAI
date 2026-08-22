import {
  assertExclusiveAllowed,
  assertHoldQuota,
  canActivateAgency,
  canHoldAgencyStatus,
  isInhousePool,
  parentKindAllowsF2,
} from './bds-agency.util';

describe('bds-agency.util', () => {
  it('only cdt_channel activates agency', () => {
    expect(canActivateAgency('cdt_channel')).toBe(true);
    expect(canActivateAgency('cdt_sales_dir')).toBe(false);
  });

  it('BDS-22 exclusive not allowed throws exclusive_tier', () => {
    expect(() => assertExclusiveAllowed(false, 'exclusive')).toThrow(
      expect.objectContaining({ error: 'exclusive_tier' }),
    );
    expect(() => assertExclusiveAllowed(false, 'shared')).not.toThrow();
    expect(() => assertExclusiveAllowed(true, 'exclusive')).not.toThrow();
  });

  it('BDS-23 quota at max throws hold_quota', () => {
    expect(() => assertHoldQuota(3, 3)).toThrow(
      expect.objectContaining({ error: 'hold_quota' }),
    );
    expect(() => assertHoldQuota(2, 3)).not.toThrow();
  });

  it('only active can hold', () => {
    expect(canHoldAgencyStatus('active')).toBe(true);
    expect(canHoldAgencyStatus('suspended')).toBe(false);
    expect(canHoldAgencyStatus('probation')).toBe(false);
  });

  it('inhouse pool detect', () => {
    expect(isInhousePool('inhouse')).toBe(true);
    expect(isInhousePool('channel')).toBe(false);
  });

  it('F2 parent kinds', () => {
    expect(parentKindAllowsF2('f1')).toBe(true);
    expect(parentKindAllowsF2('tong_dai_ly')).toBe(true);
    expect(parentKindAllowsF2('f2')).toBe(false);
  });
});
