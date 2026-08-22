import {
  applyVariantToStrategy,
  compareStrategyScenarios,
} from './marketing-ai-strategy-scenario.util';

describe('marketing-ai-strategy-scenario.util', () => {
  const baseScenario = {
    id: 1,
    lifecycle_id: 1,
    job_id: 10,
    label: 'Balanced',
    variant_slug: 'balanced',
    variant_index: 1,
    strategy_framework_json: {
      media_reach: 'Meta 35%',
      market_message: 'Balanced msg',
      target_market: 'SME',
      conversion_strategy: 'Landing',
    },
    target_market_prof_json: {},
    swot_json: { strengths: ['USP'], weaknesses: [], opportunities: [], threats: [] },
    channel_focus_json: { media_reach: 'Meta 35%' },
    messaging_json: { market_message: 'Balanced msg', target_market: 'SME' },
    is_selected: false,
    created_at: '2026-08-08',
    updated_at: '2026-08-08',
  };

  it('compareStrategyScenarios detects messaging diff', () => {
    const b = {
      ...baseScenario,
      id: 2,
      variant_slug: 'aggressive',
      strategy_framework_json: {
        ...baseScenario.strategy_framework_json,
        media_reach: 'Meta 45%',
        market_message: 'Aggressive msg',
      },
      channel_focus_json: { media_reach: 'Meta 45%' },
      messaging_json: { market_message: 'Aggressive msg', target_market: 'SME' },
    };
    const out = compareStrategyScenarios(baseScenario, b);
    expect(out.fields_changed.some((f) => f.startsWith('channel:'))).toBe(true);
    expect(out.messaging_diff.market_message.changed).toBe(true);
  });

  it('applyVariantToStrategy adjusts conservative media mix', () => {
    const base = applyVariantToStrategy(
      {
        strategy_framework: { media_reach: 'x', market_message: 'm', target_market: 't', conversion_strategy: 'c' },
        target_market_prof: {},
        swot_json: { strengths: [] },
      },
      'conservative',
    );
    expect(base.strategy_framework.media_reach).toContain('Dự phòng');
  });
});
