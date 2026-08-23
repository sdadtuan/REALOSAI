import {
  CUSTOMER_GENDER_LABELS,
  CUSTOMER_LEAD_SOURCE_LABELS,
  CustomerIssueRow,
  CustomerPurchaseRow,
  CustomerRelationRow,
  CustomerRow,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_LABELS,
  ISSUE_TYPE_LABELS,
  PURCHASE_STATUS_LABELS,
  RELATION_TYPE_LABELS,
} from './customers.types';

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

export function mapCustomerRow(row: Record<string, unknown>): CustomerRow {
  const ls = String(row.lead_source ?? '');
  const g = String(row.gender ?? '');
  return {
    id: Number(row.sqlite_customer_id ?? row.id),
    name: String(row.name ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    address: String(row.address ?? ''),
    company: String(row.company ?? ''),
    lead_source: ls,
    lead_source_label: ls ? (CUSTOMER_LEAD_SOURCE_LABELS[ls] ?? ls) : '',
    lead_source_note: String(row.lead_source_note ?? ''),
    date_of_birth: String(row.date_of_birth ?? ''),
    gender: g,
    gender_label: g ? (CUSTOMER_GENDER_LABELS[g] ?? g) : '',
    id_number: String(row.id_number ?? ''),
    occupation: String(row.occupation ?? ''),
    interests: String(row.interests ?? ''),
    profile_notes: String(row.profile_notes ?? ''),
    created_at: formatTs(row.created_at),
  };
}

export function mapRelationRow(
  row: Record<string, unknown>,
  legacyCustomerId: number,
): CustomerRelationRow {
  const rt = String(row.relation_type ?? '');
  return {
    id: Number(row.sqlite_relation_id ?? row.id),
    customer_id: legacyCustomerId,
    relation_type: rt,
    relation_type_label: RELATION_TYPE_LABELS[rt] ?? rt,
    full_name: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    notes: String(row.notes ?? ''),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapPurchaseRow(
  row: Record<string, unknown>,
  legacyCustomerId: number,
): CustomerPurchaseRow {
  const st = String(row.status ?? '');
  return {
    id: Number(row.sqlite_purchase_id ?? row.id),
    customer_id: legacyCustomerId,
    order_date: String(row.order_date ?? ''),
    product_name: String(row.product_name ?? ''),
    amount_vnd: Number(row.amount_vnd ?? 0),
    quantity: Number(row.quantity ?? 1),
    status: st,
    status_label: PURCHASE_STATUS_LABELS[st] ?? st,
    reference_code: String(row.reference_code ?? ''),
    notes: String(row.notes ?? ''),
    contract_id: row.contract_id != null ? Number(row.contract_id) : null,
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
  };
}

export function mapIssueRow(
  row: Record<string, unknown>,
  legacyCustomerId: number,
): CustomerIssueRow {
  const it = String(row.issue_type ?? '');
  const st = String(row.status ?? '');
  const pr = String(row.priority ?? '');
  return {
    id: Number(row.sqlite_issue_id ?? row.id),
    customer_id: legacyCustomerId,
    case_id: row.case_id != null ? Number(row.case_id) : null,
    issue_type: it,
    issue_type_label: ISSUE_TYPE_LABELS[it] ?? it,
    priority: pr,
    priority_label: ISSUE_PRIORITY_LABELS[pr] ?? pr,
    status: st,
    status_label: ISSUE_STATUS_LABELS[st] ?? st,
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    resolution: String(row.resolution ?? ''),
    assigned_staff_id: row.assigned_staff_id != null ? Number(row.assigned_staff_id) : null,
    assigned_staff_name: String(row.assigned_staff_name ?? ''),
    created_at: formatTs(row.created_at),
    updated_at: formatTs(row.updated_at),
    resolved_at: formatTs(row.resolved_at),
  };
}
