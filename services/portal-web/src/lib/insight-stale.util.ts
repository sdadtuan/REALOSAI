export const PORTAL_INSIGHT_STALE_BANNER =
  'Insight này có thể đã lỗi thời (hết hiệu lực). Liên hệ account manager để được cập nhật.';

/** UTC calendar date `YYYY-MM-DD`. */
export function utcDateKey(ref: Date = new Date()): string {
  return ref.toISOString().slice(0, 10);
}

export function isInsightStale(
  validTo: string | null | undefined,
  ref: Date = new Date(),
): boolean {
  const trimmed = validTo?.trim();
  if (!trimmed) return false;
  return trimmed.slice(0, 10) < utcDateKey(ref);
}

export function ragHitIsStale(hit: {
  is_stale?: boolean;
  valid_to?: string | null;
}): boolean {
  if (typeof hit.is_stale === 'boolean') return hit.is_stale;
  return isInsightStale(hit.valid_to);
}

export function reportRowIsStale(row: {
  is_stale?: boolean;
  valid_to?: string | null;
}): boolean {
  if (typeof row.is_stale === 'boolean') return row.is_stale;
  return isInsightStale(row.valid_to);
}
