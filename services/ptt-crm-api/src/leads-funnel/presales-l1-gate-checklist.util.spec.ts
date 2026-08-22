import { buildL1GateChecklist } from './presales-l1-gate-checklist.util';
import type { ProposalAdvanceGate } from './presales-proposal-gate.util';

describe('buildL1GateChecklist', () => {
  const baseGate: ProposalAdvanceGate = {
    ok: false,
    level: 'block',
    messages: ['Nhập tên kế hoạch MKT sơ bộ.'],
    consult_task_done: true,
    consult_task_total: 3,
    consult_task_done_count: 3,
    marketing_plan: { ok: false, messages: ['Nhập tên kế hoạch MKT sơ bộ.'] },
  };

  it('marks consult and plan fields from gate + plan', () => {
    const items = buildL1GateChecklist({
      gate: baseGate,
      plan: {
        name: '',
        north_star: 'NS',
        objectives: '',
        strategy_framework: { market_message: 'msg', media_reach: '', conversion_strategy: 'c' },
      },
    });
    const byKey = Object.fromEntries(items.map((i) => [i.key, i.done]));
    expect(byKey.consult).toBe(true);
    expect(byKey.plan_name).toBe(false);
    expect(byKey.north_star_or_objectives).toBe(true);
    expect(byKey.market_message).toBe(true);
    expect(byKey.media_reach).toBe(false);
    expect(byKey.conversion_strategy).toBe(true);
  });
});
