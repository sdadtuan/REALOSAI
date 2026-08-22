import type { PresalesTaskRow } from './leads-funnel.types';
import type { L1GateChecklistItem } from './presales-l1-gate-checklist.util';
import type { ProposalAdvanceGate } from './presales-proposal-gate.util';

export interface PresalesProposalHandoff {
  lead_id: number;
  customer_id: number | null;
  can_open: boolean;
  block_reason: string;
  service_slugs: string[];
  notes: string;
  proposals_href: string;
  deal_room_href: string;
  proposal_gate_ok: boolean;
  proposal_gate_messages: string[];
  l1_checklist: L1GateChecklistItem[];
}

function summarizeFormData(formData: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(formData)) {
    const text = String(value ?? '').trim();
    if (!text) continue;
    lines.push(`${key}: ${text.slice(0, 400)}`);
    if (lines.length >= 8) break;
  }
  return lines.join('\n');
}

export function buildPresalesProposalHandoff(input: {
  leadId: number;
  serviceSlug: string;
  customerId: number | null;
  consultTask: Pick<PresalesTaskRow, 'form_data' | 'ai_output' | 'notes' | 'is_done'> | null;
  proposalGate: ProposalAdvanceGate;
  l1Checklist: L1GateChecklistItem[];
}): PresalesProposalHandoff {
  const slug = String(input.serviceSlug ?? '').trim();
  const serviceSlugs = slug ? [slug] : [];
  const formData = (input.consultTask?.form_data ?? {}) as Record<string, unknown>;
  const parts: string[] = [];

  if (input.consultTask?.notes) {
    parts.push(String(input.consultTask.notes).trim());
  }
  const formSummary = summarizeFormData(formData);
  if (formSummary) {
    parts.push(`Consult form:\n${formSummary}`);
  }
  const aiOut = String(input.consultTask?.ai_output ?? '').trim();
  if (aiOut) {
    parts.push(`AI Consult:\n${aiOut.slice(0, 2500)}`);
  }

  const notes = parts.join('\n\n').slice(0, 8000);
  const qs = new URLSearchParams();
  if (input.customerId != null && input.customerId > 0) {
    qs.set('customer_id', String(input.customerId));
  }
  if (serviceSlugs.length) qs.set('service_slugs', serviceSlugs.join(','));
  if (notes) qs.set('notes', notes.slice(0, 2000));
  qs.set('lead_id', String(input.leadId));
  const proposalsHref = `/crm/proposals?${qs.toString()}`;

  let blockReason = '';
  if (!input.consultTask) {
    blockReason = 'Chưa có task Consult trên pre-sales.';
  } else if (!input.consultTask.is_done) {
    blockReason = 'Hoàn thành task Consult trước khi tạo Proposal.';
  } else if (!input.proposalGate.ok) {
    blockReason =
      input.proposalGate.messages[0] ?? 'Hoàn thành G4 R5 trước khi tạo báo giá';
  }

  return {
    lead_id: input.leadId,
    customer_id: input.customerId,
    can_open: !blockReason,
    block_reason: blockReason,
    service_slugs: serviceSlugs,
    notes,
    proposals_href: proposalsHref,
    deal_room_href: `/crm/leads/${input.leadId}/deal-room`,
    proposal_gate_ok: input.proposalGate.ok,
    proposal_gate_messages: input.proposalGate.messages,
    l1_checklist: input.l1Checklist,
  };
}
