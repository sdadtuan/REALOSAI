import type { PortalResearchReportCard } from '@/lib/api';

export const PORTAL_REPORT_LIST_STALE_BADGE =
  'Có nội dung có thể đã lỗi thời';

export const PORTAL_REPORT_STALE_ONLY_LABEL = 'Chỉ báo cáo hết hạn';

export const PORTAL_REPORT_STALE_ONLY_EMPTY = 'Không có báo cáo hết hạn.';

export function shouldShowReportListStaleBadge(
  card: { has_stale_insights?: boolean },
): boolean {
  return card.has_stale_insights === true;
}

export function countPortalReportCardsWithStaleInsights(
  cards: PortalResearchReportCard[],
): number {
  return cards.filter((card) => shouldShowReportListStaleBadge(card)).length;
}

export function filterPortalReportCardsByStale(
  cards: PortalResearchReportCard[],
  staleOnly: boolean,
): PortalResearchReportCard[] {
  if (!staleOnly) return cards;
  return cards.filter((card) => shouldShowReportListStaleBadge(card));
}
