import { buildProposalAdvanceGate } from './presales-proposal-gate.util';

describe('buildProposalAdvanceGate', () => {
  it('blocks when consult task incomplete', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 0 },
      plan: {
        name: 'Plan',
        north_star: 'NS',
        objectives: '',
        strategy_framework_json: JSON.stringify({
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        }),
      },
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages[0]).toContain('Consult');
  });

  it('blocks when R5 incomplete', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: { name: '', north_star: '', objectives: '', strategy_framework_json: '{}' },
    });
    expect(gate.ok).toBe(false);
    expect(gate.messages.some((m) => m.includes('kế hoạch') || m.includes('North Star'))).toBe(true);
  });

  it('passes when consult done and R5 valid', () => {
    const gate = buildProposalAdvanceGate({
      consultProgress: { total: 1, done: 1 },
      plan: {
        name: 'KH sơ bộ',
        north_star: 'Tăng lead',
        objectives: '',
        strategy_framework_json: JSON.stringify({
          market_message: 'msg',
          media_reach: 'media',
          conversion_strategy: 'conv',
        }),
      },
    });
    expect(gate.ok).toBe(true);
    expect(gate.level).toBe('ok');
  });
});
