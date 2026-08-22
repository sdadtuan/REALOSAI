import { collectReportInsightIds } from '../portal-research/portal-report-stale.util';
import { isInsightStale } from './insight-stale.util';

export const REPORT_PDF_STALE_FOOTER_STAFF =
  'Cảnh báo: báo cáo có insight hết hạn (valid_to). Xem lại trước khi gửi khách.';

export const REPORT_PDF_STALE_FOOTER_PORTAL =
  'Một số nội dung có thể đã lỗi thời. Liên hệ account manager để được cập nhật.';

export function reportSnapshotHasStaleInsights(
  snapshot: { findings?: unknown; recs?: unknown; insight_ids?: unknown },
  validToById: Map<number, string | null>,
  ref: Date = new Date(),
): boolean {
  const ids = collectReportInsightIds(snapshot);
  for (const id of ids) {
    if (!validToById.has(id)) continue;
    if (isInsightStale(validToById.get(id), ref)) return true;
  }
  return false;
}
