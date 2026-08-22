import type { ResearchInsight, ResearchReportVersion } from '@/lib/market-research-api';
import { reportVersionHasStaleInsights } from '@/lib/report-stale.util';

export function staffReportVersionHasStaleInsights(
  version: Pick<ResearchReportVersion, 'has_stale_insights' | 'content_snapshot'>,
  insights: ResearchInsight[],
  ref: Date = new Date(),
): boolean {
  if (typeof version.has_stale_insights === 'boolean') {
    return version.has_stale_insights;
  }
  const snap = version.content_snapshot;
  return reportVersionHasStaleInsights(snap?.findings, snap?.recs, insights, ref);
}
