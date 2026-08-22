import { buildKpiClosedLoopPayload, buildKpiClosedLoopRows } from './marketing-ai-kpi-closed-loop.util';
import type { MktAiDashboardPayload } from './marketing-ai-planner.types';

describe('marketing-ai-kpi-closed-loop.util', () => {
  const dashboard: MktAiDashboardPayload = {
    ok: true,
    lifecycle_id: 1,
    stage: 'deliver',
    agency_client_id: 'ac-1',
    linked: true,
    period: { from: '2026-07-01', to: '2026-07-31', weeks: 6, month_start: '2026-07-01' },
    tiles: {
      spend_mtd_vnd: 40_000_000,
      leads_mtd: 80,
      cpl_mtd: 500_000,
      roas_mtd: 2.5,
      roas_stub: false,
    },
    targets: { cpl_vnd: null, roas: null, source: 'none' },
    trend: [],
    deltas: { cpl_vs_target_pct: null, spend_vs_prev_week_pct: null },
    flags: { perf_tables_ready: true },
    messages: [],
  };

  it('returns empty rows when KPI tree not applied', () => {
    const out = buildKpiClosedLoopPayload({
      enabled: true,
      lifecycleId: 1,
      appliedTree: [],
      dashboard,
      thresholdPct: 15,
    });
    expect(out.has_applied_kpi_tree).toBe(false);
    expect(out.rows).toHaveLength(0);
    expect(out.messages[0]).toMatch(/Apply/);
  });

  it('joins applied KPI tree targets with dashboard actuals', () => {
    const { rows } = buildKpiClosedLoopRows({
      appliedTree: [
        {
          id: 'north_star',
          label: 'CPL',
          target: '< 400k',
          children: [{ id: 'c1', label: 'Meta Lead', target: '100 leads' }],
        },
      ],
      dashboard,
      thresholdPct: 15,
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const cplRow = rows.find((r) => r.metric_kind === 'cpl');
    expect(cplRow?.target_value).toBe(400_000);
    expect(cplRow?.actual_value).toBe(500_000);
    expect(cplRow?.alert).toBe(true);
    const leadRow = rows.find((r) => r.metric_kind === 'leads');
    expect(leadRow?.target_value).toBe(100);
    expect(leadRow?.actual_value).toBe(80);
  });

  it('uses ops actual when meta dashboard not linked', () => {
    const { rows } = buildKpiClosedLoopRows({
      appliedTree: [
        {
          id: 'k1',
          label: 'Leads tháng',
          target: '100 leads',
          unit: '',
          children: [],
        },
      ],
      dashboard: {
        ...dashboard,
        linked: false,
        tiles: {
          spend_mtd_vnd: 0,
          leads_mtd: 0,
          cpl_mtd: null,
          roas_mtd: null,
          roas_stub: false,
        },
      },
      thresholdPct: 15,
      opsMetrics: { leads: { actual: 72 } },
    });
    expect(rows[0]?.actual_value).toBe(72);
  });
});
