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
  entity_type?: string | null;
  entity_id?: string | null;
  room_id?: string | null;
  blocked_reason?: string;
  waiting_on?: string;
  created_at?: string;
};

export type WorkComment = {
  id: string;
  author_staff_id: number;
  body: string;
  created_at: string;
};

export type WorkEvent = {
  id: string;
  kind: string;
  actor_staff_id: number | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type WorkQueue = {
  code: string;
  name: string;
  kind_default: 'dept' | 'cross';
};

export type WorkTicketFilters = {
  inbox?: string;
  queue?: string;
  overdue?: boolean;
  project_id?: number;
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

function filterQuery(filters: WorkTicketFilters = {}): string {
  const params = new URLSearchParams();
  if (filters.inbox) params.set('inbox', filters.inbox);
  if (filters.queue) params.set('queue', filters.queue);
  if (filters.overdue) params.set('overdue', '1');
  if (filters.project_id != null) params.set('project_id', String(filters.project_id));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export async function fetchWorkTickets(
  token: string,
  inbox: string,
  extra: Omit<WorkTicketFilters, 'inbox'> = {},
): Promise<WorkTicket[]> {
  return staffTicketsFetch(
    token,
    `/api/v1/staff-tickets/tickets${filterQuery({ inbox, ...extra })}`,
  );
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
    project_id?: number | null;
    priority?: string;
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

export async function fetchWorkComments(token: string, ticketId: string): Promise<WorkComment[]> {
  const rows = await staffTicketsFetch<
    Array<{ id: string; author_staff_id: number; body: string; created_at: string }>
  >(token, `/api/v1/staff-tickets/tickets/${ticketId}/comments`);
  return rows.map((r) => ({
    id: r.id,
    author_staff_id: r.author_staff_id,
    body: r.body,
    created_at: String(r.created_at),
  }));
}

export async function fetchWorkEvents(token: string, ticketId: string): Promise<WorkEvent[]> {
  const rows = await staffTicketsFetch<
    Array<{
      id: string;
      kind: string;
      actor_staff_id: number | null;
      payload: Record<string, unknown>;
      created_at: string;
    }>
  >(token, `/api/v1/staff-tickets/tickets/${ticketId}/events`);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    actor_staff_id: r.actor_staff_id,
    payload: r.payload ?? {},
    created_at: String(r.created_at),
  }));
}

export async function downloadWorkExport(
  token: string,
  filters: WorkTicketFilters = {},
): Promise<void> {
  const tenantId = getBdsTenantId();
  const path = `/api/v1/staff-tickets/export${filterQuery(filters)}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `TICKETS export → ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'staff-tickets.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchWorkExportUrl(token: string, filters: WorkTicketFilters = {}): Promise<string> {
  const tenantId = getBdsTenantId();
  const path = `/api/v1/staff-tickets/export${filterQuery(filters)}`;
  return `${API_BASE}${path}`;
}

export function entityHref(ticket: WorkTicket): string | null {
  if (!ticket.entity_type || !ticket.entity_id) return null;
  if (ticket.entity_type === 'tx') return `/crm/bds/transactions?tx=${ticket.entity_id}`;
  if (ticket.entity_type === 'hold') return `/crm/bds/holds?hold=${ticket.entity_id}`;
  return null;
}
