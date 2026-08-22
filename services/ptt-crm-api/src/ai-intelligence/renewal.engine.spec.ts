import { buildRenewalDraft, computeRenewalHealth } from './renewal.engine';

describe('renewal.engine', () => {
  it('computes health and risk for T-30 contract', () => {
    const health = computeRenewalHealth({
      contract_id: 1,
      agency_client_id: 'client-1',
      client_name: 'ACME',
      contract_title: 'HĐ Meta Q3',
      ends_on: '2026-08-25',
      amount_vnd: 120_000_000,
      days_until_end: 28,
      trigger_window: 30,
      lifecycle_id: 10,
    });
    expect(health.health_score).toBeLessThan(72);
    expect(['high', 'critical', 'medium']).toContain(health.risk_level);
    expect(health.factors.length).toBeGreaterThan(0);
  });

  it('builds zalo draft shorter than email', () => {
    const candidate = {
      contract_id: 2,
      agency_client_id: 'c2',
      client_name: 'Brand X',
      contract_title: 'Agency retainer',
      ends_on: '2026-09-01',
      amount_vnd: 50_000_000,
      days_until_end: 35,
      trigger_window: 60 as const,
      lifecycle_id: null,
    };
    const zalo = buildRenewalDraft(candidate, 'zalo');
    const email = buildRenewalDraft(candidate, 'email');
    expect(zalo.length).toBeLessThan(email.length);
    expect(zalo).toContain('Brand X');
  });
});
