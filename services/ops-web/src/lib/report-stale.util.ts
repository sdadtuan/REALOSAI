import { insightIsStale } from '@/components/research/insight-stale.util';
import type { ResearchInsight } from '@/lib/market-research-api';

export function snapshotInsightId(row: unknown): number | null {
  if (!row || typeof row !== 'object') return null;
  const n = Number((row as { insight_id?: unknown }).insight_id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function insightsById(insights: ResearchInsight[]): Map<number, ResearchInsight> {
  const map = new Map<number, ResearchInsight>();
  for (const insight of insights) {
    map.set(insight.id, insight);
  }
  return map;
}

export function reportSnapshotRowIsStale(
  row: unknown,
  insightsMap: Map<number, ResearchInsight>,
  ref: Date = new Date(),
): boolean {
  const id = snapshotInsightId(row);
  if (!id) return false;
  const insight = insightsMap.get(id);
  if (!insight) return false;
  return insightIsStale(insight, ref);
}

export type ReportSnapshotStaleRow = {
  key: string;
  insightId: number;
  kind: 'finding' | 'rec';
  validTo: string | null;
};

export function collectReportSnapshotStaleRows(
  findings: unknown,
  recs: unknown,
  insights: ResearchInsight[],
  ref: Date = new Date(),
): ReportSnapshotStaleRow[] {
  const map = insightsById(insights);
  const out: ReportSnapshotStaleRow[] = [];
  const pushRows = (rows: unknown, kind: 'finding' | 'rec') => {
    if (!Array.isArray(rows)) return;
    rows.forEach((row, index) => {
      const id = snapshotInsightId(row);
      if (!id) return;
      const insight = map.get(id);
      if (!insight || !insightIsStale(insight, ref)) return;
      out.push({
        key: `${kind}-${index}-${id}`,
        insightId: id,
        kind,
        validTo: insight.valid_to,
      });
    });
  };
  pushRows(findings, 'finding');
  pushRows(recs, 'rec');
  return out;
}

export function reportVersionHasStaleInsights(
  findings: unknown,
  recs: unknown,
  insights: ResearchInsight[],
  ref: Date = new Date(),
): boolean {
  return collectReportSnapshotStaleRows(findings, recs, insights, ref).length > 0;
}
