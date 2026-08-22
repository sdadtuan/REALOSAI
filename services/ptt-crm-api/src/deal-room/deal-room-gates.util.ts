import type { ProposalAdvanceGate } from '../leads-funnel/presales-proposal-gate.util';
import type { DealRoomGateChip, DealRoomGates } from './deal-room.types';

function chip(
  key: string,
  label: string,
  status: DealRoomGateChip['status'],
  message: string,
): DealRoomGateChip {
  return { key, label, status, message };
}

export function buildDealRoomGates(input: {
  careGateComplete: boolean;
  consultDone: number;
  consultTotal: number;
  proposalGate: ProposalAdvanceGate;
  presalesStage: string;
}): DealRoomGates {
  const consultTaskDone =
    input.consultTotal === 0 || input.consultDone >= input.consultTotal;

  const g0 = input.careGateComplete
    ? chip('g0_b2', 'G0 B2', 'ok', 'B2 hoàn tất — Pre-sales mở')
    : chip('g0_b2', 'G0 B2', 'block', 'Hoàn thành B2 trước Pre-sales');

  const g1 = consultTaskDone
    ? chip('g1_consult', 'G1 Consult', 'ok', `Task Consult ${input.consultDone}/${input.consultTotal}`)
    : chip(
        'g1_consult',
        'G1 Consult',
        'block',
        `Hoàn thành task Consult (${input.consultDone}/${input.consultTotal})`,
      );

  const g4 = input.proposalGate.ok
    ? chip('g4_r5', 'G4 R5', 'ok', 'KH MKT sơ bộ hợp lệ')
    : chip(
        'g4_r5',
        'G4 R5',
        'block',
        input.proposalGate.messages.filter(Boolean).join(' · ') || 'R5 chưa đủ điều kiện',
      );

  let g5: DealRoomGateChip;
  if (input.presalesStage === 'proposal') {
    g5 = chip('g5_proposal', 'G5 Proposal', 'ok', 'Đang giai đoạn Báo giá');
  } else if (input.proposalGate.ok) {
    g5 = chip('g5_proposal', 'G5 Proposal', 'warn', 'Sẵn sàng tạo báo giá');
  } else {
    g5 = chip('g5_proposal', 'G5 Proposal', 'pending', 'Chưa mở Báo giá');
  }

  const g6 = chip('g6_accept', 'G6 Accept', 'pending', 'Chốt HĐ + cọc trên Hub');

  return { g0_b2: g0, g1_consult: g1, g4_r5: g4, g5_proposal: g5, g6_accept: g6 };
}
