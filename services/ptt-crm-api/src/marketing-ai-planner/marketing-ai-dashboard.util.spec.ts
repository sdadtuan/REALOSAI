import type { PerformanceRow } from '../performance/performance.types';
import {
  buildDashboardDeltas,
  buildDashboardTargets,
  buildDashboardTiles,
  buildDashboardTrend,
  resolveDashboardDateWindow,
} from './marketing-ai-dashboard.util';

describe('marketing-ai-dashboard.util', () => {
  const rows: PerformanceRow[] = [
    {
      performance_date: '2026-08-01',
      spend: 1_000_000,
      leads_crm: 10,
      conversion_value: 3_000_000,
      target_cpl_vnd: 100_000,
      roas_stub: false,
      external_campaign_id: null,
      external_campaign_name: null,
      currency: 'VND',
      impressions: 0,
      clicks: 0,
      leads_platform: 0,
      cpl: null,
      cpl_delta_vnd: null,
      cpl_delta_pct: null,
      roas: null,
      hub_campaign_map_id: null,
      hub_campaign_id: null,
      hub_mapped: true,
      synced_at: null,
    },
    {
      performance_date: '2026-08-02',
      spend: 500_000,
      leads_crm: 5,
      conversion_value: 1_500_000,
      target_cpl_vnd: 100_000,
      roas_stub: false,
      external_campaign_id: null,
      external_campaign_name: null,
      currency: 'VND',
      impressions: 0,
      clicks: 0,
      leads_platform: 0,
      cpl: null,
      cpl_delta_vnd: null,
      cpl_delta_pct: null,
      roas: null,
      hub_campaign_map_id: null,
      hub_campaign_id: null,
      hub_mapped: true,
      synced_at: null,
    },
    {
      performance_date: '2026-07-28',
      spend: 800_000,
      leads_crm: 8,
      conversion_value: 2_000_000,
      target_cpl_vnd: 90_000,
      roas_stub: true,
      external_campaign_id: null,
      external_campaign_name: null,
      currency: 'VND',
      impressions: 0,
      clicks: 0,
      leads_platform: 0,
      cpl: null,
      cpl_delta_vnd: null,
      cpl_delta_pct: null,
      roas: null,
      hub_campaign_map_id: null,
      hub_campaign_id: null,
      hub_mapped: true,
      synced_at: null,
    },
  ];

  it('buildDashboardTiles sums MTD spend and leads', () => {
    const tiles = buildDashboardTiles(rows, '2026-08-01', '2026-08-07');
    expect(tiles.spend_mtd_vnd).toBe(1_500_000);
    expect(tiles.leads_mtd).toBe(15);
    expect(tiles.cpl_mtd).toBe(100_000);
  });

  it('buildDashboardTrend groups by ISO week', () => {
    const trend = buildDashboardTrend(rows, 6, '2026-08-07');
    expect(trend.length).toBeGreaterThan(0);
    expect(trend.some((w) => w.leads > 0)).toBe(true);
  });

  it('buildDashboardDeltas computes CPL vs target', () => {
    const trend = buildDashboardTrend(rows, 6, '2026-08-07');
    const targets = buildDashboardTargets(rows);
    const deltas = buildDashboardDeltas(trend, targets);
    expect(targets.cpl_vnd).toBeGreaterThan(0);
    expect(deltas.cpl_vs_target_pct).not.toBeNull();
  });

  it('resolveDashboardDateWindow returns monthStart and dateTo', () => {
    const win = resolveDashboardDateWindow(6);
    expect(win.dateFrom <= win.monthStart).toBe(true);
    expect(win.dateTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
