import { buildMktAiPortalSummary, pickStrategyExcerpt, redactPortalText } from './portal-mkt-ai-summary.util';

describe('portal-mkt-ai-summary.util', () => {
  it('redactPortalText masks email and phone', () => {
    expect(redactPortalText('Liên hệ admin@test.vn hoặc 0901234567')).toContain('[email]');
    expect(redactPortalText('Liên hệ admin@test.vn hoặc 0901234567')).toContain('[phone]');
  });

  it('pickStrategyExcerpt truncates to 500 chars', () => {
    const long = 'a'.repeat(600);
    expect(
      pickStrategyExcerpt({ target_market_prof: { market_context: long } } as never, null),
    ).toHaveLength(500);
  });

  it('buildMktAiPortalSummary maps campaign count and staff url', () => {
    const out = buildMktAiPortalSummary({
      lifecycleId: 42,
      serviceSlug: 'meta-lead-gen',
      brief: { brand_name: 'Acme' },
      draft: {
        campaigns_json: [{ name: 'C1' }, { name: 'C2' }],
        target_market_prof: { market_context: 'ICP logistics HCM' },
      } as never,
      qualityScore: 72,
      playbookLabel: 'Meta Lead Gen',
      lastUpdatedAt: '2026-08-08T00:00:00.000Z',
      opsWebBaseUrl: 'https://ops.example.com',
    });
    expect(out.campaign_count).toBe(2);
    expect(out.strategy_excerpt).toContain('ICP logistics');
    expect(out.staff_planner_url).toBe(
      'https://ops.example.com/crm/service-delivery/42?tab=ai-planner',
    );
  });
});
