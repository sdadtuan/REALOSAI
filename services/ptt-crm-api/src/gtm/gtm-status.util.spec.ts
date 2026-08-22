import { canTransitionGtmStatus } from './gtm-status.util';

describe('gtm-status.util', () => {
  it('allows new to qualified', () => {
    expect(canTransitionGtmStatus('new', 'qualified')).toBe(true);
  });

  it('rejects new to won', () => {
    expect(canTransitionGtmStatus('new', 'won')).toBe(false);
  });

  it('allows demo_booked to sandbox_granted', () => {
    expect(canTransitionGtmStatus('demo_booked', 'sandbox_granted')).toBe(true);
  });

  it('rejects terminal transitions', () => {
    expect(canTransitionGtmStatus('won', 'lost')).toBe(false);
    expect(canTransitionGtmStatus('disqualified', 'qualified')).toBe(false);
  });
});
