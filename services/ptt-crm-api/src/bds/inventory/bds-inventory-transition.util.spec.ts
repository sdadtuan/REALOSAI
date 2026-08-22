import { assertUnitTransition } from './bds-inventory-transition.util';

describe('assertUnitTransition', () => {
  it('hold: available → hold', () => {
    expect(assertUnitTransition('available', 'hold')).toBe('hold');
  });

  it('ttl: hold → available', () => {
    expect(assertUnitTransition('hold', 'ttl')).toBe('available');
  });

  it('reservation_fee: hold → reserved', () => {
    expect(assertUnitTransition('hold', 'reservation_fee')).toBe('reserved');
  });

  it('reservation window miss: reserved → available', () => {
    expect(assertUnitTransition('reserved', 'reservation_expire')).toBe('available');
  });

  it('deposit: reserved → booked', () => {
    expect(assertUnitTransition('reserved', 'deposit')).toBe('booked');
  });

  it('deposit from hold (không giữ chỗ tiền)', () => {
    expect(assertUnitTransition('hold', 'deposit')).toBe('booked');
  });

  it('contract: booked → sold', () => {
    expect(assertUnitTransition('booked', 'contract')).toBe('sold');
  });

  it('cancel booked → available (BDS-14 inventory)', () => {
    expect(assertUnitTransition('booked', 'cancel')).toBe('available');
  });

  it('cdt_lock from available → locked', () => {
    expect(assertUnitTransition('available', 'cdt_lock')).toBe('locked');
  });

  it('unlock: locked → available', () => {
    expect(assertUnitTransition('locked', 'unlock')).toBe('available');
  });

  it('rejects sold → available without reverse_sold', () => {
    expect(() => assertUnitTransition('sold', 'cancel')).toThrow(/sold/);
  });

  it('rejects hold from booked', () => {
    expect(() => assertUnitTransition('booked', 'hold')).toThrow(/illegal_transition/);
  });
});
