import {
  buildKpiContextFromDashboard,
  buildRuleBasedOptimizeRecommendations,
  filterOptimizeRecommendations,
  normalizeOptimizeRecommendations,
  resolveOptimizeTaskStage,
} from './marketing-ai-optimize.util';

describe('marketing-ai-optimize.util', () => {
  const dashboard = {
    ok: true,
    lifecycle_id: 1,
    stage: 'deliver',
    agency_client_id: 'CLI-1',
    linked: true,
    period: { from: '2026-07-01', to: '2026-08-07', weeks: 6, month_start: '2026-08-01' },
    tiles: {
      spend_mtd_vnd: 5_000_000,
      leads_mtd: 20,
      cpl_mtd: 250_000,
      roas_mtd: 2.1,
      roas_stub: false,
    },
    targets: { cpl_vnd: 200_000, roas: null, source: 'daily_performance' as const },
    trend: [],
    deltas: { cpl_vs_target_pct: 25, spend_vs_prev_week_pct: 10 },
    flags: { perf_tables_ready: true },
    messages: [],
  };

  it('buildRuleBasedOptimizeRecommendations returns 3 actions when CPL delta > 15', () => {
    const recs = buildRuleBasedOptimizeRecommendations({
      dashboard,
      brief: null,
      campaigns: [],
      lifecycleStage: 'deliver',
    });
    expect(recs.length).toBeGreaterThanOrEqual(3);
    expect(recs[0].suggested_task.stage).toBe('deliver');
  });

  it('filterOptimizeRecommendations removes dismissed ids', () => {
    const recs = buildRuleBasedOptimizeRecommendations({
      dashboard,
      brief: null,
      campaigns: [],
      lifecycleStage: 'deliver',
    });
    const filtered = filterOptimizeRecommendations(recs, [recs[0].id]);
    expect(filtered.some((r) => r.id === recs[0].id)).toBe(false);
  });

  it('normalizeOptimizeRecommendations falls back on bad JSON', () => {
    const fb = buildRuleBasedOptimizeRecommendations({
      dashboard,
      brief: null,
      campaigns: [],
      lifecycleStage: 'deliver',
    });
    expect(normalizeOptimizeRecommendations({}, fb)).toEqual(fb);
  });

  it('resolveOptimizeTaskStage defaults to deliver', () => {
    expect(resolveOptimizeTaskStage('onboard')).toBe('deliver');
    expect(resolveOptimizeTaskStage('retain')).toBe('retain');
  });

  it('buildKpiContextFromDashboard maps dashboard fields', () => {
    const ctx = buildKpiContextFromDashboard(dashboard);
    expect(ctx.cpl_delta_pct).toBe(25);
    expect(ctx.spend_mtd_vnd).toBe(5_000_000);
  });
});
