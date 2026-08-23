import type { StaffTicketService } from '../../staff-tickets/staff-ticket.service';
import {
  BDS_SPINE_HANDOFF,
  type BdsSpineEventType,
  bdsSpineIdempotencyKey,
} from './bds-spine-idempotency';

export async function replayHandoffTicket(
  tickets: Pick<StaffTicketService, 'createHandoffTicket'> | null | undefined,
  tenantId: string,
  input: {
    event_type: BdsSpineEventType;
    aggregate_id: string;
    stage?: string;
    title: string;
    body: string;
    requester_dept_code?: string | null;
    project_id?: number | null;
    queue_code?: string;
    entity_type?: string;
  },
): Promise<{ id: string } | null> {
  if (!tickets) return null;
  const catalog = BDS_SPINE_HANDOFF[input.event_type];
  const stage = input.stage ?? catalog.default_stage;
  const out = await tickets.createHandoffTicket(tenantId, {
    queue_code: input.queue_code ?? catalog.queue_code,
    title: input.title,
    body: input.body,
    entity_type: input.entity_type ?? catalog.entity_type,
    entity_id: String(input.aggregate_id),
    requester_dept_code: input.requester_dept_code ?? null,
    project_id: input.project_id ?? null,
    idempotency_key: bdsSpineIdempotencyKey({
      event_type: input.event_type,
      aggregate_id: String(input.aggregate_id),
      stage,
    }),
  });
  return out;
}
