import { maskDependentCccd, lifecycleStageLabel, isExpiringDate } from './hr-staff-p5.util';

describe('hr-staff-p5.util', () => {
  it('maskDependentCccd hides full number without cap', () => {
    expect(maskDependentCccd('001234567890', false)).toBe('•••• 890');
    expect(maskDependentCccd('001234567890', true)).toBe('001234567890');
  });

  it('lifecycleStageLabel maps known stages', () => {
    expect(lifecycleStageLabel('probation')).toBe('Thử việc');
    expect(lifecycleStageLabel('unknown')).toBe('unknown');
  });

  it('isExpiringDate detects within 30 days', () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(isExpiringDate(soon, 30)).toBe(true);
    expect(isExpiringDate(null)).toBe(false);
  });
});
