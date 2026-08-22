import type {
  AdminAuditEvent,
  AdminAuditEventCategory,
  AdminAuditSeverity,
} from './admin-audit.types';

const SENSITIVE_ACTIONS = new Set(['configure', 'delete', 'view_pii']);

function capEntries(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const section = String(o.section_id ?? o.section ?? '');
        const action = String(o.action ?? '');
        if (section && action) return `${section}.${action}`;
      }
      return '';
    })
    .filter(Boolean);
}

function matrixDiffHasSensitive(diff: Record<string, unknown>): boolean {
  const added = capEntries(diff.added);
  const removed = capEntries(diff.removed);
  return [...added, ...removed].some((cap) => {
    const action = cap.split('.').pop() ?? '';
    return SENSITIVE_ACTIONS.has(action);
  });
}

export function severityForPermissionMatrix(diff: Record<string, unknown>): AdminAuditSeverity {
  return matrixDiffHasSensitive(diff) ? 'critical' : 'info';
}

export function severityForOrgAction(action: string): AdminAuditSeverity {
  const a = action.toLowerCase();
  if (a.includes('offboard') || a.includes('deactivate') || a === 'delete') return 'warning';
  return 'info';
}

export function severityForRbacEvent(eventType: string, metadata: Record<string, unknown>): AdminAuditSeverity {
  const t = eventType.toLowerCase();
  if (t.includes('break_glass') && String(metadata.status ?? metadata.action ?? '').includes('approve')) {
    return 'critical';
  }
  if (t.includes('break_glass')) return 'warning';
  return 'info';
}

export function mapPermissionAuditRow(row: {
  id: number;
  actor_email: string;
  position_id: number;
  position_code: string;
  diff_json: Record<string, unknown>;
  created_at: string;
}): AdminAuditEvent {
  const diff = row.diff_json ?? {};
  const functionCode = String(diff.function_code ?? '');
  const isFunction = Boolean(functionCode) || row.position_id === 0;
  const positionCode = String(diff.position_code ?? row.position_code ?? row.position_id);
  const added = Array.isArray(diff.added) ? diff.added.length : 0;
  const removed = Array.isArray(diff.removed) ? diff.removed.length : 0;
  const category: AdminAuditEventCategory = isFunction ? 'permission_function' : 'permission_matrix';
  const subjectLabel = isFunction ? functionCode || 'job-function' : positionCode;
  const summary = isFunction
    ? `Đổi job function ${subjectLabel}: +${added} / -${removed} cap`
    : `Đổi ma trận ${subjectLabel}: +${added} / -${removed} cap`;

  return {
    id: `permission_audit:${row.id}`,
    source: 'permission_audit',
    category,
    severity: severityForPermissionMatrix(diff),
    actor_email: row.actor_email,
    subject_label: subjectLabel,
    subject_id: isFunction ? functionCode : String(row.position_id),
    action: isFunction ? 'patch_job_function' : 'patch_matrix',
    summary,
    diff_json: diff,
    created_at: row.created_at,
  };
}

export function mapOrgAuditRow(row: {
  id: number;
  actor_email: string;
  entity_type: string;
  entity_id: string;
  action: string;
  diff_json: Record<string, unknown>;
  created_at: string;
}): AdminAuditEvent {
  const entityType = row.entity_type.toLowerCase();
  const category: AdminAuditEventCategory =
    entityType === 'user' || entityType === 'staff_user' ? 'org_user' : 'org_structure';
  const subjectLabel =
    String(row.diff_json?.email ?? row.diff_json?.display_name ?? row.entity_id ?? '').trim() ||
    row.entity_id;
  const actionLabel = row.action.replace(/_/g, ' ');
  const summary =
    category === 'org_user'
      ? `${actionLabel} — ${subjectLabel}`
      : `${actionLabel} ${entityType} ${subjectLabel}`;

  return {
    id: `org_audit:${row.id}`,
    source: 'org_audit',
    category,
    severity: category === 'org_user' ? severityForOrgAction(row.action) : 'info',
    actor_email: row.actor_email,
    subject_label: subjectLabel,
    subject_id: row.entity_id,
    action: row.action,
    summary,
    diff_json: row.diff_json ?? {},
    created_at: row.created_at,
  };
}

export function mapRbacAuditRow(row: {
  id: number;
  event_type: string;
  actor_email: string;
  subject_user_id?: string;
  section_id: string;
  action: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}): AdminAuditEvent {
  const metadata = row.metadata_json ?? {};
  const summary = row.event_type.includes('break_glass')
    ? `Break-glass: ${String(metadata.status ?? row.action ?? row.event_type)}`
    : `RBAC ${row.event_type.replace(/_/g, ' ')}`;

  return {
    id: `rbac_audit:${row.id}`,
    source: 'rbac_audit',
    category: 'rbac_event',
    severity: severityForRbacEvent(row.event_type, metadata),
    actor_email: row.actor_email,
    subject_label: row.subject_user_id ? String(metadata.email ?? row.subject_user_id) : undefined,
    subject_id: row.subject_user_id,
    action: row.event_type,
    summary,
    diff_json: metadata,
    created_at: row.created_at,
  };
}

export function mapPiiAccessRow(row: {
  id: number;
  actor_email: string;
  resource_type: string;
  resource_id: string;
  field_path: string;
  action: string;
  request_path: string;
  created_at: string;
}): AdminAuditEvent {
  return {
    id: `pii_access:${row.id}`,
    source: 'pii_access',
    category: 'pii_access',
    severity: 'info',
    actor_email: row.actor_email,
    subject_label: `${row.resource_type}:${row.resource_id}`,
    subject_id: row.resource_id,
    action: row.action,
    summary: `Xem PII ${row.field_path} — ${row.resource_type} ${row.resource_id}`,
    diff_json: {
      field_path: row.field_path,
      request_path: row.request_path,
      resource_type: row.resource_type,
    },
    created_at: row.created_at,
  };
}

export function mapAdminAuditLogRow(row: {
  id: number;
  event_type: string;
  actor_email: string;
  category: string;
  severity: string;
  subject_label: string;
  subject_id: string;
  action: string;
  summary: string;
  diff_json: Record<string, unknown>;
  created_at: string;
}): AdminAuditEvent {
  return {
    id: `admin_audit_log:${row.id}`,
    source: 'admin_audit_log',
    category: (row.category as AdminAuditEventCategory) || 'config_snapshot',
    severity: (row.severity as AdminAuditSeverity) || 'info',
    actor_email: row.actor_email,
    subject_label: row.subject_label || undefined,
    subject_id: row.subject_id || undefined,
    action: row.action,
    summary: row.summary,
    diff_json: row.diff_json ?? {},
    created_at: row.created_at,
  };
}

export function parseAuditCursor(cursor?: string): { created_at: string; sort_key: string } | null {
  if (!cursor?.trim()) return null;
  const idx = cursor.lastIndexOf('|');
  if (idx <= 0) return null;
  return {
    created_at: cursor.slice(0, idx),
    sort_key: cursor.slice(idx + 1),
  };
}

export function buildAuditCursor(event: AdminAuditEvent): string {
  return `${event.created_at}|${event.id}`;
}
