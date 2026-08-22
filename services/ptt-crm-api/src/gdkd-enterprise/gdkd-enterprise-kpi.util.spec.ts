import {
  buildGdkdEnterpriseKpiResponse,
  evaluateKpiPass,
  GDKD_KPI_TARGETS,
  slaTierCompliancePct,
} from './gdkd-enterprise-kpi.util';

describe('gdkd-enterprise-kpi.util', () => {
  it('computes SLA tier compliance from ok/breach', () => {
    expect(slaTierCompliancePct({ ok: 17, breach: 3 })).toBe(85);
    expect(slaTierCompliancePct({ ok: 0, breach: 0 })).toBeNull();
  });

  it('evaluates pass/fail comparators', () => {
    expect(evaluateKpiPass(85, 85, 'gte')).toBe(true);
    expect(evaluateKpiPass(84.9, 85, 'gte')).toBe(false);
    expect(evaluateKpiPass(0, 0, 'lte')).toBe(true);
    expect(evaluateKpiPass(23, 24, 'lt')).toBe(true);
    expect(evaluateKpiPass(null, 35, 'gte')).toBeNull();
  });

  it('builds 8 enterprise tiles with targets', () => {
    const out = buildGdkdEnterpriseKpiResponse({
      generatedAt: '2026-08-04T00:00:00.000Z',
      windowDays: 7,
      closedLoopWindowDays: 30,
      slaTiers: {
        first_call_15m: {
          ok: 17,
          breach: 3,
          warning: 1,
          active: 21,
          evaluated: 20,
          compliance_pct: 85,
          target_pct: 85,
          compliance_pass: true,
        },
        b2_complete_4h: {
          ok: 8,
          breach: 2,
          warning: 0,
          active: 10,
          evaluated: 10,
          compliance_pct: 80,
          target_pct: 80,
          compliance_pass: true,
        },
        close_24h: {
          ok: 7,
          breach: 3,
          warning: 0,
          active: 10,
          evaluated: 10,
          compliance_pct: 70,
          target_pct: 70,
          compliance_pass: true,
        },
      },
      breachBacklog: 8,
      breachShiftLabel: 'Ca chiều',
      breachGatePass: false,
      reviewQueueCount: 2,
      reviewQueueMaxHours: 20,
      reviewQueueAvgHours: 18,
      reviewQueueOver24h: 0,
      reviewQueueAgeGatePass: true,
      copilotDauRatePct: 62,
      copilotDauLatest: 3,
      pilotDenominator: 5,
      nbaAcceptancePct: 40,
      nbaResolved: 10,
      nbaAccepted: 4,
      dealValueFillPct: 92,
      vndFillGatePass: true,
      chotTotal: 25,
    });

    expect(out.tiles).toHaveLength(8);
    expect(out.tiles[0]?.pass).toBe(true);
    expect(out.tiles[0]?.gate_pass).toBe(true);
    expect(out.tiles.every((t) => t.gate_pass === t.pass)).toBe(true);
    expect(out.tiles[3]?.pass).toBe(false);
    expect(out.tiles[4]?.pass).toBe(true);
    expect(out.tiles[6]?.target).toBe(GDKD_KPI_TARGETS.nba_acceptance_pct);
    expect(out.summary.pass_count + out.summary.fail_count + out.summary.na_count).toBe(8);
  });
});
