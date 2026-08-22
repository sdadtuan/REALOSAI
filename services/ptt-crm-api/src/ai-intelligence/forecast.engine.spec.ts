import { computeRevenueForecastV1 } from './forecast.engine';

describe('computeRevenueForecastV1', () => {
  it('computes weighted pipeline and AI adjustment with stalled penalty', () => {
    const out = computeRevenueForecastV1({
      deals: [
        {
          deal_id: 1,
          title: 'Deal A',
          pipeline_stage: 'sql',
          deal_value_vnd: 100_000_000,
          weighted_vnd: 50_000_000,
          stalled_days: 10,
          is_stalled: true,
        },
        {
          deal_id: 2,
          title: 'Deal B',
          pipeline_stage: 'bao_gia',
          deal_value_vnd: 50_000_000,
          weighted_vnd: 35_000_000,
          stalled_days: 1,
          is_stalled: false,
        },
      ],
      stageLabels: { sql: 'SQL', bao_gia: 'Báo giá' },
      month: 7,
      now: new Date('2026-07-10T12:00:00'),
    });

    expect(out.pipeline_amount).toBe(85_000_000);
    expect(out.stalled_deal_count).toBe(1);
    expect(out.ai_adjustment).toBeLessThan(0);
    expect(out.forecast_amount).toBe(out.pipeline_amount + out.ai_adjustment);
    expect(out.best_case_amount).toBe(150_000_000);
    expect(out.factors.some((f) => f.key === 'stalled_penalty')).toBe(true);
  });

  it('returns zero forecast for empty pipeline', () => {
    const out = computeRevenueForecastV1({
      deals: [],
      stageLabels: {},
      month: 8,
    });
    expect(out.pipeline_amount).toBe(0);
    expect(out.forecast_amount).toBe(0);
    expect(out.confidence_score).toBe(0.5);
  });
});
