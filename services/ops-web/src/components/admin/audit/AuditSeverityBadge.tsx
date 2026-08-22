'use client';

import type { AdminAuditSeverity } from '@/lib/api';

const LABELS: Record<AdminAuditSeverity, string> = {
  info: 'Thông tin',
  warning: 'Cảnh báo',
  critical: 'Nghiêm trọng',
};

export function AuditSeverityBadge({ severity }: { severity: AdminAuditSeverity }) {
  return (
    <span className={`admin-audit-severity admin-audit-severity--${severity}`}>
      {LABELS[severity]}
    </span>
  );
}

export const AUDIT_CATEGORY_LABELS: Record<string, string> = {
  permission_matrix: 'Ma trận chức vụ',
  permission_function: 'Job function',
  org_user: 'Người dùng',
  org_structure: 'Tổ chức',
  rbac_event: 'RBAC',
  pii_access: 'Truy cập PII',
  config_snapshot: 'Snapshot',
};
