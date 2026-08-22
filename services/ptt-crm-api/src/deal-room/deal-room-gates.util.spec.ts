import { buildDealRoomGates } from './deal-room-gates.util';

describe('buildDealRoomGates', () => {
  const baseGate = {
    ok: false,
    level: 'block' as const,
    messages: ['Nhập tên kế hoạch MKT sơ bộ.'],
    consult_task_done: false,
    consult_task_total: 2,
    consult_task_done_count: 1,
    marketing_plan: { ok: false, messages: ['Nhập tên kế hoạch MKT sơ bộ.'] },
  };

  it('marks G0 block when B2 incomplete', () => {
    const gates = buildDealRoomGates({
      careGateComplete: false,
      consultDone: 0,
      consultTotal: 0,
      proposalGate: baseGate,
      presalesStage: 'consult',
    });
    expect(gates.g0_b2.status).toBe('block');
  });

  it('marks G4 ok when proposal gate passes', () => {
    const gates = buildDealRoomGates({
      careGateComplete: true,
      consultDone: 2,
      consultTotal: 2,
      proposalGate: { ...baseGate, ok: true, messages: [], marketing_plan: { ok: true, messages: [] } },
      presalesStage: 'consult',
    });
    expect(gates.g4_r5.status).toBe('ok');
    expect(gates.g5_proposal.status).toBe('warn');
  });

  it('marks G5 ok on proposal stage', () => {
    const gates = buildDealRoomGates({
      careGateComplete: true,
      consultDone: 1,
      consultTotal: 1,
      proposalGate: { ...baseGate, ok: true, messages: [], marketing_plan: { ok: true, messages: [] } },
      presalesStage: 'proposal',
    });
    expect(gates.g5_proposal.status).toBe('ok');
  });
});
