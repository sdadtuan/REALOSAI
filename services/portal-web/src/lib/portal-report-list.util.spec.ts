import { describe, expect, it } from 'vitest';
import type { PortalResearchReportCard } from '@/lib/api';
import {
  PORTAL_REPORT_LIST_STALE_BADGE,
  PORTAL_REPORT_STALE_ONLY_EMPTY,
  PORTAL_REPORT_STALE_ONLY_LABEL,
  countPortalReportCardsWithStaleInsights,
  filterPortalReportCardsByStale,
  shouldShowReportListStaleBadge,
} from './portal-report-list.util';

const staleCard = {
  version_id: 1,
  version: 1,
  has_stale_insights: true,
} as PortalResearchReportCard;
const freshCard = {
  version_id: 2,
  version: 2,
  has_stale_insights: false,
} as PortalResearchReportCard;

describe('portal-report-list.util', () => {
  it('P41 badge copy is list-level not report-expired claim', () => {
    expect(PORTAL_REPORT_LIST_STALE_BADGE).toMatch(/có thể đã lỗi thời/i);
    expect(PORTAL_REPORT_LIST_STALE_BADGE).not.toMatch(/báo cáo hết hạn|ISO|cert/i);
  });

  it('P41 shouldShowReportListStaleBadge only when flag true', () => {
    expect(shouldShowReportListStaleBadge({ has_stale_insights: true })).toBe(true);
    expect(shouldShowReportListStaleBadge({ has_stale_insights: false })).toBe(false);
    expect(shouldShowReportListStaleBadge({})).toBe(false);
  });

  it('P46 count stale cards', () => {
    expect(countPortalReportCardsWithStaleInsights([staleCard, freshCard])).toBe(1);
  });

  it('P46 filter staleOnly keeps only stale cards', () => {
    expect(filterPortalReportCardsByStale([staleCard, freshCard], true)).toEqual([staleCard]);
  });

  it('P46 filter off returns all cards', () => {
    expect(filterPortalReportCardsByStale([staleCard, freshCard], false)).toHaveLength(2);
  });

  it('P46 copy does not claim report expired', () => {
    expect(PORTAL_REPORT_STALE_ONLY_LABEL).toMatch(/báo cáo hết hạn/i);
    expect(PORTAL_REPORT_STALE_ONLY_EMPTY).not.toMatch(/ISO|cert/i);
  });
});
