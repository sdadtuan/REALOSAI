import type { MktAiStrategyScenarioRow } from './marketing-ai-planner.types';

export const STRATEGY_VARIANTS: Array<{
  slug: 'conservative' | 'balanced' | 'aggressive';
  label: string;
}> = [
  { slug: 'conservative', label: 'Conservative — an toàn CPL' },
  { slug: 'balanced', label: 'Balanced — cân bằng kênh' },
  { slug: 'aggressive', label: 'Aggressive — scale nhanh' },
];

function swotLists(swot: Record<string, unknown>): Record<string, string[]> {
  const pick = (k: string) =>
    Array.isArray(swot[k]) ? (swot[k] as unknown[]).map((x) => String(x)).filter(Boolean) : [];
  return {
    strengths: pick('strengths'),
    weaknesses: pick('weaknesses'),
    opportunities: pick('opportunities'),
    threats: pick('threats'),
  };
}

function listDiff(a: string[], b: string[]) {
  const setB = new Set(b);
  const setA = new Set(a);
  return {
    a,
    b,
    only_a: a.filter((x) => !setB.has(x)),
    only_b: b.filter((x) => !setA.has(x)),
  };
}

export function compareStrategyScenarios(
  scenarioA: MktAiStrategyScenarioRow,
  scenarioB: MktAiStrategyScenarioRow,
) {
  const swotA = swotLists(scenarioA.swot_json);
  const swotB = swotLists(scenarioB.swot_json);
  const swot_diff: Record<string, { a: string[]; b: string[]; only_a: string[]; only_b: string[] }> =
    {};
  for (const key of ['strengths', 'weaknesses', 'opportunities', 'threats']) {
    swot_diff[key] = listDiff(swotA[key], swotB[key]);
  }

  const channelKeys = ['media_reach', 'conversion_strategy'] as const;
  const channel_diff: Record<string, { a: string; b: string; changed: boolean }> = {};
  for (const key of channelKeys) {
    const a =
      scenarioA.channel_focus_json[key] ??
      scenarioA.strategy_framework_json[key] ??
      '';
    const b =
      scenarioB.channel_focus_json[key] ??
      scenarioB.strategy_framework_json[key] ??
      '';
    channel_diff[key] = { a: String(a), b: String(b), changed: String(a) !== String(b) };
  }

  const messagingKeys = ['market_message', 'target_market'] as const;
  const messaging_diff: Record<string, { a: string; b: string; changed: boolean }> = {};
  for (const key of messagingKeys) {
    const a =
      scenarioA.messaging_json[key] ?? scenarioA.strategy_framework_json[key] ?? '';
    const b =
      scenarioB.messaging_json[key] ?? scenarioB.strategy_framework_json[key] ?? '';
    messaging_diff[key] = { a: String(a), b: String(b), changed: String(a) !== String(b) };
  }

  const fields_changed = [
    ...Object.entries(channel_diff).filter(([, v]) => v.changed).map(([k]) => `channel:${k}`),
    ...Object.entries(messaging_diff).filter(([, v]) => v.changed).map(([k]) => `messaging:${k}`),
    ...Object.entries(swot_diff)
      .filter(([, v]) => v.only_a.length || v.only_b.length)
      .map(([k]) => `swot:${k}`),
  ];

  return {
    ok: true as const,
    scenario_a: scenarioA,
    scenario_b: scenarioB,
    swot_diff,
    channel_diff,
    messaging_diff,
    fields_changed,
  };
}

export function applyVariantToStrategy(
  base: {
    strategy_framework: Record<string, string>;
    target_market_prof: Record<string, string>;
    swot_json: Record<string, unknown>;
  },
  variantSlug: 'conservative' | 'balanced' | 'aggressive',
): {
  strategy_framework: Record<string, string>;
  target_market_prof: Record<string, string>;
  swot_json: Record<string, unknown>;
  channel_focus_json: Record<string, string>;
  messaging_json: Record<string, string>;
} {
  const sf = { ...base.strategy_framework };
  const prof = { ...base.target_market_prof };
  const swot = { ...base.swot_json };

  if (variantSlug === 'conservative') {
    sf.media_reach =
      'Meta lead 25% · Google Search 25% · Landing CRO 15% · Email nurture 15% · Dự phòng test 20%';
    sf.market_message = `[Conservative] ${sf.market_message ?? ''}`.slice(0, 280);
    prof.success_hypotheses_next =
      'Giả thuyết an toàn: CPL ổn định 6 tuần trước khi scale; ưu tiên quality lead.';
    const threats = Array.isArray(swot.threats) ? [...(swot.threats as string[])] : [];
    if (!threats.some((t) => /CPL/i.test(t))) threats.push('CPL biến động khi scale nhanh');
    swot.threats = threats;
  } else if (variantSlug === 'aggressive') {
    sf.media_reach =
      'Meta lead 45% · Google Search 30% · Landing 10% · Retarget 10% · Dự phòng 5%';
    sf.market_message = `[Aggressive] ${sf.market_message ?? ''}`.slice(0, 280);
    prof.success_hypotheses_next =
      'Giả thuyết tăng trưởng: scale budget +20% sau 2 tuần CPL đạt target.';
    const opportunities = Array.isArray(swot.opportunities) ? [...(swot.opportunities as string[])] : [];
    opportunities.push('Mở rộng geo / lookalike nhanh khi CPL ổn');
    swot.opportunities = opportunities;
  }

  return {
    strategy_framework: sf,
    target_market_prof: prof,
    swot_json: swot,
    channel_focus_json: {
      media_reach: sf.media_reach ?? '',
      conversion_strategy: sf.conversion_strategy ?? '',
    },
    messaging_json: {
      market_message: sf.market_message ?? '',
      target_market: sf.target_market ?? '',
    },
  };
}
