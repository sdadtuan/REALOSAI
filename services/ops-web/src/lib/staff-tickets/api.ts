import { API_BASE } from '@/lib/api';
import { getBdsTenantId } from '@/lib/bds/api';

export type WorkTicket = {
  id: string;
  number: string;
  kind: 'dept' | 'cross';
  queue_code: string;
  title: string;
  body: string;
  hidden?: boolean;
  status: string;
  priority: string;
  sla_due_at: string | null;
  sla_breached: boolean;
  assignee_staff_id?: number | null;
};

export type WorkQueue = {
  code: string;
  name: string;
  kind_default: 'dept' | 'cross';
};

async function staffTicketsFetch<T>(token: string, path: string): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`TICKETS ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function staffTicketsMutate<T>(
  token: string,
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `TICKETS ${path} → ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchWorkTickets(token: string, inbox: string): Promise<WorkTicket[]> {
  const q = inbox ? `?inbox=${encodeURIComponent(inbox)}` : '';
  return staffTicketsFetch(token, `/api/v1/staff-tickets/tickets${q}`);
}

export async function fetchWorkQueues(token: string): Promise<WorkQueue[]> {
  return staffTicketsFetch(token, '/api/v1/staff-tickets/queues');
}

export function postWorkTicket(
  token: string,
  body: {
    kind: 'dept' | 'cross';
    queue_code: string;
    title: string;
    body?: string;
    room_id?: string | null;
    entity_type?: string | null;
    entity_id?: string | null;
  },
) {
  return staffTicketsMutate<WorkTicket>(token, '/api/v1/staff-tickets/tickets', 'POST', body);
}

export function postWorkTransition(
  token: string,
  id: string,
  to: string,
  extra?: { reason?: string; comment?: string },
) {
  return staffTicketsMutate<WorkTicket>(
    token,
    `/api/v1/staff-tickets/tickets/${id}/transition`,
    'POST',
    { to, ...extra },
  );
}

export function postWorkAssign(token: string, id: string, staffId?: number) {
  return staffTicketsMutate<WorkTicket>(
    token,
    `/api/v1/staff-tickets/tickets/${id}/assign`,
    'POST',
    staffId == null ? {} : { staff_id: staffId },
  );
}
