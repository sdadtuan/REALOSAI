import {
  CareReportRow,
  CaseRow,
  CRM_CARE_CONTACT_LABELS,
  CRM_CARE_STATUS_LABELS,
  CRM_CHANNEL_LABELS,
  CRM_PRIORITY_LABELS,
  CRM_STATUS_LABELS,
} from './cases.types';

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

export function mapCaseRow(row: Record<string, unknown>): CaseRow {
  const displayName = row.staff_display_name;
  let assignedTo = String(row.assigned_to ?? '');
  if (displayName) {
    assignedTo = String(displayName);
  }
  const status = String(row.status ?? '');
  const priority = String(row.priority ?? '');
  const channel = String(row.channel ?? '');
  return {
    id: Number(row.sqlite_case_id ?? row.id),
    customer_id: Number(row.customer_legacy_id ?? row.customer_id),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    channel,
    channel_label: CRM_CHANNEL_LABELS[channel] ?? channel,
    priority,
    priority_label: CRM_PRIORITY_LABELS[priority] ?? priority,
    status,
    status_label: CRM_STATUS_LABELS[status] ?? status,
    pipeline_stage: String(row.pipeline_stage ?? ''),
    assigned_to: assignedTo,
    assigned_staff_id:
      row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
    assigned_at: formatTs(row.assigned_at),
    campaign_id: row.campaign_id != null ? Number(row.campaign_id) : null,
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
    customer_name: String(row.customer_name ?? ''),
    customer_phone: String(row.customer_phone ?? ''),
    customer_email: String(row.customer_email ?? ''),
    customer_address: String(row.customer_address ?? ''),
    customer_company: String(row.customer_company ?? ''),
    staff_display_name: String(displayName ?? ''),
  };
}

export function mapCareReportRow(
  row: Record<string, unknown>,
  legacyCaseId: number,
): CareReportRow {
  const contactType = String(row.contact_type ?? '');
  const careStatus = String(row.care_status ?? '');
  return {
    id: Number(row.sqlite_report_id ?? row.id),
    case_id: legacyCaseId,
    staff_id: row.staff_id != null ? Number(row.staff_id) : null,
    staff_name: String(row.staff_name ?? ''),
    contact_type: contactType,
    contact_type_label: CRM_CARE_CONTACT_LABELS[contactType] ?? contactType,
    care_status: careStatus,
    care_status_label: CRM_CARE_STATUS_LABELS[careStatus] ?? careStatus,
    summary: String(row.summary ?? ''),
    next_action: String(row.next_action ?? ''),
    created_at: formatTs(row.created_at),
  };
}
