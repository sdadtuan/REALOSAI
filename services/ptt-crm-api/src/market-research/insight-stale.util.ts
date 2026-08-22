/** UTC calendar date `YYYY-MM-DD`. */
export function utcDateKey(ref: Date = new Date()): string {
  return ref.toISOString().slice(0, 10);
}

/** FR-INS-07: stale when `valid_to` is set and strictly before today (UTC). */
export function isInsightStale(
  validTo: string | null | undefined,
  ref: Date = new Date(),
): boolean {
  const trimmed = validTo?.trim();
  if (!trimmed) return false;
  return trimmed.slice(0, 10) < utcDateKey(ref);
}
