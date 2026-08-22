import {
  assertDepositMin,
  canAdvanceTx,
  decideTxChannel,
  isOpenTxStage,
  unitEventForCancel,
  unitEventForConvert,
  unitEventForReservation,
} from './bds-tx.util';

describe('bds-tx.util', () => {
  it('BDS-11 deposit under min throws deposit_min', () => {
    expect(() => assertDepositMin(50, 100)).toThrow(
      expect.objectContaining({ error: 'deposit_min' }),
    );
  });

  it('deposit at or over min ok', () => {
    expect(() => assertDepositMin(100, 100)).not.toThrow();
    expect(() => assertDepositMin(150, 100)).not.toThrow();
  });

  it('empty channel → inhouse', () => {
    expect(decideTxChannel('')).toBe('inhouse');
    expect(decideTxChannel(undefined)).toBe('inhouse');
  });

  it('non-empty channel → agency', () => {
    expect(decideTxChannel('ag-1')).toBe('agency');
  });

  it('open stages exclude cancelled/lost', () => {
    expect(isOpenTxStage('deposit')).toBe(true);
    expect(isOpenTxStage('contracted')).toBe(true);
    expect(isOpenTxStage('cancelled')).toBe(false);
    expect(isOpenTxStage('lost')).toBe(false);
  });

  it('advance deposit→vbtt / deposit→contracted / vbtt→contracted', () => {
    expect(canAdvanceTx('deposit', 'vbtt')).toBe(true);
    expect(canAdvanceTx('deposit', 'contracted')).toBe(true);
    expect(canAdvanceTx('vbtt', 'contracted')).toBe(true);
    expect(canAdvanceTx('reservation', 'deposit')).toBe(true);
    expect(canAdvanceTx('contracted', 'cancelled')).toBe(false);
    expect(canAdvanceTx('deposit', 'reservation')).toBe(false);
  });

  it('unit events', () => {
    expect(unitEventForConvert('hold')).toBe('deposit');
    expect(unitEventForConvert('reserved')).toBe('deposit');
    expect(() => unitEventForConvert('booked')).toThrow(
      expect.objectContaining({ error: 'unit_locked' }),
    );
    expect(unitEventForReservation()).toBe('reservation_fee');
    expect(unitEventForCancel('reserved')).toBe('cancel');
    expect(unitEventForCancel('booked')).toBe('cancel');
    expect(() => unitEventForCancel('available')).toThrow(
      expect.objectContaining({ error: 'unit_locked' }),
    );
  });
});
