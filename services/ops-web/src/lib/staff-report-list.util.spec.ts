import { describe, expect, it } from 'vitest';
import type { ResearchInsight } from '@/lib/market-research-api';
import {
  STAFF_REPORT_STALE_ONLY_EMPTY,
  STAFF_REPORT_STALE_ONLY_LABEL,
  STAFF_REPORT_VERSION_STALE_BADGE,
  countStaffReportVersionsWithStaleInsights,
  filterStaffReportVersionsByStale,
  shouldShowStaffVersionStaleBadge,
  type StaffReportVersionRow,
} from './staff-report-list.util';

const ref = new Date('2026-08-01T12:00:00Z');
const insights = [{ id: 1, valid_to: '2026-07-01' }] as ResearchInsight[];
const staleRow: StaffReportVersionRow = {
  report: { id: 10 } as StaffReportVersionRow['report'],
  version: {
    id: 100,
    has_stale_insights: true,
    content_snapshot: { findings: [{ insight_id: 1 }], recs: [] },
  } as StaffReportVersionRow['version'],
};
const freshRow: StaffReportVersionRow = {
  report: { id: 11 } as StaffReportVersionRow['report'],
  version: {
    id: 101,
    has_stale_insights: false,
    content_snapshot: { findings: [], recs: [] },
  } as StaffReportVersionRow['version'],
};

describe('staff-report-list.util', () => {
  it('P43 badge copy is list-level not report-expired claim', () => {
    expect(STAFF_REPORT_VERSION_STALE_BADGE).toMatch(/có thể đã lỗi thời/i);
    expect(STAFF_REPORT_VERSION_STALE_BADGE).not.toMatch(/báo cáo hết hạn|ISO|cert/i);
  });

  it('P43 shouldShowStaffVersionStaleBadge only when true', () => {
    expect(shouldShowStaffVersionStaleBadge(true)).toBe(true);
    expect(shouldShowStaffVersionStaleBadge(false)).toBe(false);
  });

  it('P45 count stale versions', () => {
    expect(countStaffReportVersionsWithStaleInsights([staleRow, freshRow], insights, ref)).toBe(1);
  });

  it('P45 filter staleOnly keeps only stale rows', () => {
    expect(filterStaffReportVersionsByStale([staleRow, freshRow], insights, true, ref)).toEqual([
      staleRow,
    ]);
  });

  it('P45 filter off returns all rows', () => {
    expect(filterStaffReportVersionsByStale([staleRow, freshRow], insights, false, ref)).toHaveLength(
      2,
    );
  });

  it('P45 copy does not claim report expired', () => {
    expect(STAFF_REPORT_STALE_ONLY_LABEL).toMatch(/version hết hạn/i);
    expect(STAFF_REPORT_STALE_ONLY_EMPTY).not.toMatch(/báo cáo hết hạn/i);
  });
});
