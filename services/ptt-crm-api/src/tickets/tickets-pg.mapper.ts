import {
  CRM_CHANNEL_LABELS,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  TicketMessageRow,
  TicketRow,
} from './tickets.types';

function formatTs(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  const s = String(value ?? '');
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    return s.replace('T', ' ').slice(0, 19);
  }
  return s;
}

export function mapTicketRow(
  row: Record<string, unknown>,
  agencyClientId: string | null = null,
): TicketRow {
  const ticketType = String(row.ticket_type ?? 'phan_anh');
  const status = String(row.status ?? 'moi');
  const priority = String(row.priority ?? 'binh_thuong');
  const channel = String(row.channel ?? 'khac');
  return {
    id: Number(row.sqlite_ticket_id ?? row.id),
    customer_id: Number(row.legacy_customer_id ?? row.sqlite_customer_id ?? row.customer_id),
    customer_name: String(row.customer_name ?? '—'),
    agency_client_id: agencyClientId,
    ticket_type: ticketType,
    ticket_type_label: ISSUE_TYPE_LABELS[ticketType] ?? ticketType,
    status,
    status_label: ISSUE_STATUS_LABELS[status] ?? status,
    priority,
    priority_label: ISSUE_PRIORITY_LABELS[priority] ?? priority,
    channel,
    channel_label: CRM_CHANNEL_LABELS[channel] ?? channel,
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    resolution: String(row.resolution ?? ''),
    assigned_staff_id:
      row.assigned_staff_id != null && row.assigned_staff_id !== ''
        ? Number(row.assigned_staff_id)
        : null,
    assigned_staff_name: String(row.assigned_staff_name ?? '—'),
    sentiment_label: String(row.sentiment_label ?? '').trim() || null,
    sentiment_score: row.sentiment_score != null ? Number(row.sentiment_score) : null,
    sentiment_confidence:
      row.sentiment_confidence != null ? Number(row.sentiment_confidence) : null,
    sentiment_scored_at: formatTs(row.sentiment_scored_at).trim() || null,
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
    resolved_at: formatTs(row.resolved_at),
  };
}

export function mapMessageRow(
  row: Record<string, unknown>,
  legacyTicketId: number,
): TicketMessageRow {
  return {
    id: Number(row.sqlite_message_id ?? row.id),
    ticket_id: legacyTicketId,
    author_staff_id:
      row.author_staff_id != null && row.author_staff_id !== ''
        ? Number(row.author_staff_id)
        : null,
    author_staff_name: String(row.author_staff_name ?? 'Hệ thống'),
    body: String(row.body ?? ''),
    is_internal: row.is_internal === true || Number(row.is_internal ?? 1) === 1,
    created_at: formatTs(row.created_at),
  };
}
