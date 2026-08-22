'use client';

import { InsightStaleBanner } from '@/components/research/InsightStaleBanner';
import { collectReportSnapshotStaleRows } from '@/lib/report-stale.util';
import type { ResearchInsight } from '@/lib/market-research-api';

export function ReportStaleInsightList({
  findings,
  recs,
  insights,
}: {
  findings?: unknown;
  recs?: unknown;
  insights: ResearchInsight[];
}) {
  const staleRows = collectReportSnapshotStaleRows(findings, recs, insights);
  if (staleRows.length === 0) return null;
  return (
    <div data-testid="staff-report-stale-list">
      {staleRows.map((row) => (
        <div key={row.key} data-testid={`staff-report-stale-row-${row.insightId}`}>
          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.78rem' }}>
            {row.kind === 'finding' ? 'Finding' : 'Rec'} #{row.insightId}
          </p>
          <InsightStaleBanner validTo={row.validTo} />
        </div>
      ))}
    </div>
  );
}
