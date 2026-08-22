export const INSIGHT_STALE_BANNER =
  'Insight đã hết hạn (valid_to). Cập nhật hiệu lực trước khi dùng cho báo cáo / khách.';

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

export function insightIsStale(
  insight: { is_stale?: boolean; valid_to?: string | null },
  ref: Date = new Date(),
): boolean {
  if (typeof insight.is_stale === 'boolean') return insight.is_stale;
  return isInsightStale(insight.valid_to, ref);
}

export function ragHitIsStale(
  hit: { is_stale?: boolean; valid_to?: string | null },
  ref: Date = new Date(),
): boolean {
  return insightIsStale(hit, ref);
}
