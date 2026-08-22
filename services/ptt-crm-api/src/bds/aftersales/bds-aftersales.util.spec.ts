import {
  HANDOVER_CHECK_CODES,
  appointmentDue,
  canAdvanceTitle,
  canHandover,
} from './bds-aftersales.util';

describe('bds-aftersales.util', () => {
  it('catalog has 4 codes', () => {
    expect(HANDOVER_CHECK_CODES).toEqual(['water', 'electric', 'interior', 'minutes']);
  });

  it('BDS-38: missing pass → cannot handover', () => {
    expect(canHandover([{ item_code: 'water', status: 'pass' }], { waive: false })).toBe(false);
  });

  it('all 4 pass → can handover', () => {
    const checks = HANDOVER_CHECK_CODES.map((item_code) => ({ item_code, status: 'pass' as const }));
    expect(canHandover(checks, { waive: false })).toBe(true);
  });

  it('fail item blocks even if others pass', () => {
    const checks = HANDOVER_CHECK_CODES.map((item_code) => ({
      item_code,
      status: item_code === 'water' ? ('fail' as const) : ('pass' as const),
    }));
    expect(canHandover(checks, { waive: false })).toBe(false);
  });

  it('waive + approve + reason ≥3 → can handover', () => {
    expect(
      canHandover([], { waive: true, hasApproveCap: true, waiveReason: 'KH nhận thô' }),
    ).toBe(true);
  });

  it('waive without approve cap → false', () => {
    expect(canHandover([], { waive: true, hasApproveCap: false, waiveReason: 'ok ok' })).toBe(false);
  });

  it('title submitted → issued → handed_to_buyer', () => {
    expect(canAdvanceTitle('not_started', 'submitted')).toBe(true);
    expect(canAdvanceTitle('submitted', 'issued')).toBe(true);
    expect(canAdvanceTitle('issued', 'handed_to_buyer')).toBe(true);
    expect(canAdvanceTitle('not_started', 'issued')).toBe(false);
    expect(canAdvanceTitle('handed_to_buyer', 'submitted')).toBe(false);
  });

  it('appointmentDue when missing or within 15 days', () => {
    const now = new Date('2026-08-22T00:00:00Z');
    expect(appointmentDue(null, now)).toBe(true);
    expect(appointmentDue(new Date('2026-08-30T00:00:00Z'), now)).toBe(true);
    expect(appointmentDue(new Date('2026-10-01T00:00:00Z'), now)).toBe(false);
  });
});
