import { hashGtmIp } from './gtm-ip.util';

describe('gtm-ip.util', () => {
  it('returns deterministic SHA-256 hex', () => {
    const a = hashGtmIp('203.0.113.1', 'test-salt');
    const b = hashGtmIp('203.0.113.1', 'test-salt');
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('throws when salt is empty', () => {
    expect(() => hashGtmIp('203.0.113.1', '')).toThrow('GTM_IP_SALT missing');
  });
});
