'use client';

import {
  STAFF_REPORT_VERSION_STALE_BADGE,
  shouldShowStaffVersionStaleBadge,
} from '@/lib/staff-report-list.util';

export function StaffReportVersionStaleBadge({ hasStaleInsights }: { hasStaleInsights: boolean }) {
  if (!shouldShowStaffVersionStaleBadge(hasStaleInsights)) return null;
  return (
    <span
      className="muted"
      data-testid="staff-report-version-stale-badge"
      style={{
        display: 'inline-block',
        marginLeft: '0.45rem',
        padding: '0.12rem 0.4rem',
        borderRadius: 6,
        fontSize: '0.76rem',
        background: 'rgba(180, 83, 9, 0.12)',
        color: '#92400e',
      }}
    >
      {STAFF_REPORT_VERSION_STALE_BADGE}
    </span>
  );
}
