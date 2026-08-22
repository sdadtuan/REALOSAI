import { buildPresalesProposalHandoff } from './presales-proposal-handoff.util';
import type { ProposalAdvanceGate } from './presales-proposal-gate.util';

const baseGate: ProposalAdvanceGate = {
  ok: true,
  level: 'ok',
  messages: [],
  consult_task_done: true,
  consult_task_total: 1,
  consult_task_done_count: 1,
  marketing_plan: { ok: true, messages: [] },
};

describe('presales-proposal-handoff.util', () => {
  it('builds proposals href with slug and notes', () => {
    const handoff = buildPresalesProposalHandoff({
      leadId: 42,
      serviceSlug: 'lead-gen',
      customerId: 7,
      consultTask: {
        form_data: { goal: 'Full funnel' },
        ai_output: 'AI audit summary',
        notes: 'Note consult',
        is_done: true,
      },
      proposalGate: baseGate,
      l1Checklist: [],
    });
    expect(handoff.can_open).toBe(true);
    expect(handoff.service_slugs).toEqual(['lead-gen']);
    expect(handoff.proposals_href).toContain('customer_id=7');
    expect(handoff.proposals_href).toContain('service_slugs=lead-gen');
    expect(handoff.deal_room_href).toBe('/crm/leads/42/deal-room');
    expect(handoff.notes).toContain('AI audit summary');
  });

  it('blocks when consult task not done', () => {
    const handoff = buildPresalesProposalHandoff({
      leadId: 1,
      serviceSlug: 'dich-vu-aeo',
      customerId: null,
      consultTask: {
        form_data: {},
        ai_output: '',
        notes: '',
        is_done: false,
      },
      proposalGate: baseGate,
      l1Checklist: [],
    });
    expect(handoff.can_open).toBe(false);
    expect(handoff.block_reason).toMatch(/Hoàn thành task Consult/);
  });

  it('blocks when G4 proposal gate fails', () => {
    const handoff = buildPresalesProposalHandoff({
      leadId: 99,
      serviceSlug: 'meta-lead-gen',
      customerId: 3,
      consultTask: {
        form_data: {},
        ai_output: '',
        notes: '',
        is_done: true,
      },
      proposalGate: {
        ...baseGate,
        ok: false,
        level: 'block',
        messages: ['Điền khối chiến lược: market_message.'],
        marketing_plan: { ok: false, messages: ['Điền khối chiến lược: market_message.'] },
      },
      l1Checklist: [],
    });
    expect(handoff.can_open).toBe(false);
    expect(handoff.proposal_gate_ok).toBe(false);
    expect(handoff.block_reason).toMatch(/market_message/);
  });
});
