import { isBhytExpiringSoon, maskInsuranceNo } from './hr-insurance.util';

describe('hr-insurance.util', () => {
  it('isBhytExpiringSoon within 30 days', () => {
    const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(isBhytExpiringSoon(soon)).toBe(true);
  });

  it('maskInsuranceNo hides without PII cap', () => {
    expect(maskInsuranceNo('1234567890', false)).toBe('•••• 890');
    expect(maskInsuranceNo('1234567890', true)).toBe('1234567890');
  });
});
