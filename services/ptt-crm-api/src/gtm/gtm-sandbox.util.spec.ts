import {
  canGrantSandbox,
  oneTimePassword,
  sandboxExpiresAt,
  sandboxTenant,
  sandboxUsername,
} from './gtm-sandbox.util';

describe('gtm-sandbox.util', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-15T10:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('grant allowed only for qualified or demo_booked', () => {
    expect(canGrantSandbox('qualified')).toBe(true);
    expect(canGrantSandbox('demo_booked')).toBe(true);
    expect(canGrantSandbox('new')).toBe(false);
    expect(canGrantSandbox('sandbox_granted')).toBe(false);
  });

  it('sandboxUsername shortens long uuid to 8 chars', () => {
    expect(sandboxUsername('550e8400-e29b-41d4-a716-446655440000')).toBe('demo_550e8400');
    expect(sandboxUsername('abc')).toBe('demo_abc');
  });

  it('sandboxTenant prefixes industry', () => {
    expect(sandboxTenant('agency')).toBe('sandbox_agency');
  });

  it('sandboxExpiresAt adds 14 days', () => {
    const from = new Date('2026-08-15T10:00:00.000Z');
    expect(sandboxExpiresAt(from).toISOString()).toBe('2026-08-29T10:00:00.000Z');
  });

  it('oneTimePassword returns 16 alphanumeric chars', () => {
    const otp = oneTimePassword();
    expect(otp).toHaveLength(16);
    expect(otp).toMatch(/^[A-Za-z0-9]+$/);
  });
});
