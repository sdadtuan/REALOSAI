import {
  buildKpiAlertKey,
  detectKpiDrifts,
  isCplDrift,
  isRoasDrift,
  resolveAlertWeekStart,
} from './marketing-ai-kpi-alert.util';

describe('marketing-ai-kpi-alert.util', () => {
  const dashboard = {
    ok: true,
    lifecycle_id: 7,
    stage: 'deliver',
    agency_client_id: 'CLI-1',
    linked: true,
    period: { from: '2026-07-01', to: '2026-08-07', weeks: 6, month_start: '2026-08-01' },
    tiles: {
      spend_mtd_vnd: 5_000_000,
      leads_mtd: 20,
      cpl_mtd: 250_000,
      roas_mtd: 1.8,
      roas_stub: false,
    },
    targets: { cpl_vnd: 200_000, roas: null, source: 'daily_performance' as const },
    trend: [
      {
        week_label: 'Tuần 28/07',
        week_start: '2026-07-28',
        spend_vnd: 1_000_000,
        leads: 10,
        cpl: 100_000,
        roas: 2.5,
        roas_stub: false,
      },
      {
        week_label: 'Tuần 04/08',
        week_start: '2026-08-04',
        spend_vnd: 1_200_000,
        leads: 8,
        cpl: 150_000,
        roas: 1.8,
        roas_stub: false,
      },
    ],
    deltas: { cpl_vs_target_pct: 22, spend_vs_prev_week_pct: 20 },
    flags: { perf_tables_ready: true },
    messages: [],
  };

  it('buildKpiAlertKey encodes lifecycle metric week', () => {
    expect(buildKpiAlertKey(1, 'cpl', '2026-08-04')).toBe('mkt_ai_kpi:1:cpl:2026-08-04');
  });

  it('isCplDrift respects threshold', () => {
    expect(isCplDrift(14, 15)).toBe(false);
    expect(isCplDrift(15, 15)).toBe(true);
  });

  it('isRoasDrift respects threshold', () => {
    expect(isRoasDrift(19, 20)).toBe(false);
    expect(isRoasDrift(28, 20)).toBe(true);
  });

  it('detectKpiDrifts returns cpl and roas when both drift', () => {
    const findings = detectKpiDrifts({
      lifecycleId: 7,
      brandLabel: 'ABC Logistics',
      dashboard,
      cplThresholdPct: 15,
      roasThresholdPct: 20,
    });
    expect(findings.length).toBe(2);
    expect(findings[0].metric).toBe('cpl');
    expect(findings[1].metric).toBe('roas');
    expect(findings[0].alert_key).toContain('2026-08-04');
  });

  it('resolveAlertWeekStart uses latest trend week', () => {
    expect(resolveAlertWeekStart(dashboard)).toBe('2026-08-04');
  });
});
