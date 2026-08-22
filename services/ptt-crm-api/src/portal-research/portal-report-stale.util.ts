import { isInsightStale } from '../market-research/insight-stale.util';

function asPositiveId(raw: unknown): number | null {
  const n = Number((raw as { insight_id?: unknown })?.insight_id ?? raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function collectReportInsightIds(input: {
  findings?: unknown;
  recs?: unknown;
  insight_ids?: unknown;
}): number[] {
  const out = new Set<number>();
  for (const row of [input.findings, input.recs]) {
    if (!Array.isArray(row)) continue;
    for (const item of row) {
      const id = item && typeof item === 'object' ? asPositiveId(item) : null;
      if (id) out.add(id);
    }
  }
  if (Array.isArray(input.insight_ids)) {
    for (const raw of input.insight_ids) {
      const id = asPositiveId(raw);
      if (id) out.add(id);
    }
  }
  return [...out];
}

export function annotatePortalReportRow(
  row: unknown,
  validToById: Map<number, string | null>,
  ref: Date = new Date(),
): unknown {
  if (!row || typeof row !== 'object') return row;
  const id = asPositiveId(row);
  if (!id) return row;
  const validTo = validToById.has(id) ? validToById.get(id) ?? null : null;
  return {
    ...(row as Record<string, unknown>),
    valid_to: validTo,
    is_stale: isInsightStale(validTo, ref),
  };
}
