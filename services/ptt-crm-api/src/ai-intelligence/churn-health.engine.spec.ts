import { computeChurnHealth, computeTicketSpike } from './churn-health.engine';

describe('churn-health.engine', () => {
  it('detects ticket spike when last 7d doubles baseline', () => {
    expect(computeTicketSpike(4, 1)).toBe(true);
    expect(computeTicketSpike(1, 0)).toBe(false);
  });

  it('lowers score for ticket spike and payment delay', () => {
    const health = computeChurnHealth({
      client_id: 'client-1',
      client_name: 'ACME',
      owner_am_id: 'am@pttads.vn',
      status: 'active',
      signals: {
        contract_days_until_end: 120,
        contract_amount_vnd: 20_000_000,
        lifecycle_id: 3,
        tickets_open: 4,
        tickets_last_7d: 6,
        tickets_prev_7d: 2,
        ticket_spike: true,
        negative_tickets_open: 2,
        payment_overdue_vnd: 8_000_000,
        payment_overdue_count: 2,
      },
    });
    expect(health.health_score).toBeLessThan(55);
    expect(health.ticket_spike).toBe(true);
    expect(health.renewal_recommended).toBe(true);
    expect(health.factors.some((f) => f.key === 'ticket_spike')).toBe(true);
    expect(health.factors.some((f) => f.key === 'payment_overdue_high')).toBe(true);
  });

  it('keeps healthy band for stable client', () => {
    const health = computeChurnHealth({
      client_id: 'client-2',
      client_name: 'Stable Co',
      owner_am_id: null,
      status: 'active',
      signals: {
        contract_days_until_end: 200,
        contract_amount_vnd: 50_000_000,
        lifecycle_id: 1,
        tickets_open: 0,
        tickets_last_7d: 0,
        tickets_prev_7d: 0,
        ticket_spike: false,
        negative_tickets_open: 0,
        payment_overdue_vnd: 0,
        payment_overdue_count: 0,
      },
    });
    expect(health.health_band).toBe('healthy');
    expect(health.renewal_recommended).toBe(false);
  });
});
