import { hashPhoneForCapi, isDncBlocked } from './b2b-dnc.util';

describe('isDncBlocked', () => {
  it('blocks listed phone', () => {
    expect(isDncBlocked('0900000000', ['0900000000'])).toBe(true);
  });

  it('allows unlisted phone', () => {
    expect(isDncBlocked('0901234567', ['0900000000'])).toBe(false);
  });

  it('normalizes +84 prefix', () => {
    expect(isDncBlocked('+84900000000', ['0900000000'])).toBe(true);
  });
});

describe('hashPhoneForCapi', () => {
  it('returns sha256 hex for valid phone', () => {
    expect(hashPhoneForCapi('0901234567')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns null for empty phone', () => {
    expect(hashPhoneForCapi('')).toBeNull();
  });
});
