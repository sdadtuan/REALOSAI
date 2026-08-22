function asPositiveId(raw: unknown): number | null {
  const n = Number((raw as { insight_id?: unknown })?.insight_id ?? raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function stampPublishedValidTo(
  row: unknown,
  validToById: Map<number, string | null>,
): unknown {
  if (!row || typeof row !== 'object') return row;
  const id = asPositiveId(row);
  if (!id) return row;
  return {
    ...(row as Record<string, unknown>),
    published_valid_to: validToById.has(id) ? validToById.get(id) ?? null : null,
  };
}

export function bakePublishedValidTo(
  snapshot: { findings?: unknown; recs?: unknown },
  validToById: Map<number, string | null>,
): { findings: unknown[]; recs: unknown[] } {
  return {
    findings: Array.isArray(snapshot.findings)
      ? snapshot.findings.map((row) => stampPublishedValidTo(row, validToById))
      : [],
    recs: Array.isArray(snapshot.recs)
      ? snapshot.recs.map((row) => stampPublishedValidTo(row, validToById))
      : [],
  };
}
