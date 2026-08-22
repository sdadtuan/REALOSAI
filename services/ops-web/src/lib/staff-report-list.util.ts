import type { ResearchInsight, ResearchReport, ResearchReportVersion } from '@/lib/market-research-api';
import { staffReportVersionHasStaleInsights } from '@/lib/staff-report-stale.util';

export const STAFF_REPORT_VERSION_STALE_BADGE =
  'Có nội dung có thể đã lỗi thời';

export const STAFF_REPORT_STALE_ONLY_LABEL = 'Chỉ version hết hạn';

export const STAFF_REPORT_STALE_ONLY_EMPTY = 'Không có version hết hạn.';

export type StaffReportVersionRow = {
  report: ResearchReport;
  version: ResearchReportVersion;
};

export function shouldShowStaffVersionStaleBadge(hasStaleInsights: boolean): boolean {
  return hasStaleInsights;
}

export function countStaffReportVersionsWithStaleInsights(
  rows: StaffReportVersionRow[],
  insights: ResearchInsight[],
  ref: Date = new Date(),
): number {
  return rows.filter((row) =>
    staffReportVersionHasStaleInsights(row.version, insights, ref),
  ).length;
}

export function filterStaffReportVersionsByStale(
  rows: StaffReportVersionRow[],
  insights: ResearchInsight[],
  staleOnly: boolean,
  ref: Date = new Date(),
): StaffReportVersionRow[] {
  if (!staleOnly) return rows;
  return rows.filter((row) =>
    staffReportVersionHasStaleInsights(row.version, insights, ref),
  );
}
