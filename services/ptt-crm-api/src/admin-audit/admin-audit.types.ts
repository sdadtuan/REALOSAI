export type AdminAuditEventCategory =
  | 'permission_matrix'
  | 'permission_function'
  | 'org_user'
  | 'org_structure'
  | 'rbac_event'
  | 'pii_access'
  | 'config_snapshot';

export type AdminAuditEventSource =
  | 'permission_audit'
  | 'org_audit'
  | 'rbac_audit'
  | 'pii_access'
  | 'admin_audit_log';

export type AdminAuditSeverity = 'info' | 'warning' | 'critical';

export type AdminAuditEvent = {
  id: string;
  source: AdminAuditEventSource;
  category: AdminAuditEventCategory;
  severity: AdminAuditSeverity;
  actor_email: string;
  subject_label?: string;
  subject_id?: string;
  action: string;
  summary: string;
  diff_json: Record<string, unknown>;
  created_at: string;
};

export type AdminAuditListQuery = {
  from?: string;
  to?: string;
  actor?: string;
  subject?: string;
  category?: AdminAuditEventCategory[];
  severity?: AdminAuditSeverity[];
  q?: string;
  cursor?: string;
  limit?: number;
};

export type AdminAuditListResponse = {
  events: AdminAuditEvent[];
  next_cursor: string | null;
  has_more: boolean;
};

export type AdminAuditExportFormat = 'csv' | 'json';

export type AdminAuditExportRequest = {
  format: AdminAuditExportFormat;
  from?: string;
  to?: string;
  actor?: string;
  subject?: string;
  category?: AdminAuditEventCategory[];
  severity?: AdminAuditSeverity[];
  q?: string;
};

export type AdminAuditExportJob = {
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  format: AdminAuditExportFormat;
  row_count?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
};

export type AdminConfigSnapshotRequest = {
  snapshot_type: 'permission_matrix' | 'org_chart';
  entity_key: string;
  note?: string;
};

export type AdminConfigSnapshot = {
  id: number;
  snapshot_type: string;
  entity_key: string;
  signed_by: string;
  signed_at: string;
  note: string;
};
