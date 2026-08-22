export function percentile50(hours: number[]): number | null {
  if (!hours.length) return null;
  const s = [...hours].sort((a, b) => a - b);
  const mid = Math.floor((s.length - 1) / 2);
  return s.length % 2 ? s[mid] : (s[mid] + s[mid + 1]) / 2;
}

export function completenessPct(total: number, withVerified: number): number {
  if (total <= 0) return 0;
  return Math.round((100 * withVerified) / total);
}
