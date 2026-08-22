import {
  decideHoldActor,
  initialHoldStatus,
  ttlMinutes,
} from './bds-hold.util';

describe('bds-hold.util', () => {
  it('empty channel_partner_id → inhouse', () => {
    expect(decideHoldActor('')).toBe('inhouse');
    expect(decideHoldActor('  ')).toBe('inhouse');
    expect(decideHoldActor(undefined)).toBe('inhouse');
  });

  it('non-empty channel_partner_id → channel', () => {
    expect(decideHoldActor('ag-1')).toBe('channel');
  });

  it('BDS-06 inhouse auto-approve → active', () => {
    expect(initialHoldStatus('inhouse', true)).toBe('active');
  });

  it('inhouse when autoApprove false → pending', () => {
    expect(initialHoldStatus('inhouse', false)).toBe('pending');
  });

  it('BDS-05 channel always pending', () => {
    expect(initialHoldStatus('channel', true)).toBe('pending');
  });

  it('ttl 30 presale / 1440 selling / tenant override', () => {
    expect(ttlMinutes('planning', undefined)).toBe(30);
    expect(ttlMinutes('selling', undefined)).toBe(1440);
    expect(ttlMinutes('selling', 15)).toBe(15);
  });
});
