export function waveDelta(prev: number | null, curr: number | null): number | null {
  if (prev == null || curr == null) return null;
  return curr - prev;
}

export function compareLatestWaves(
  waves: Array<{ wave_no: number; metric_json: { key: string; value: number | null }[] }>,
): { key: string; prev: number | null; curr: number | null; delta: number | null }[] {
  const sorted = [...waves].sort((a, b) => a.wave_no - b.wave_no);
  if (sorted.length < 2) return [];
  const prev = sorted[sorted.length - 2];
  const curr = sorted[sorted.length - 1];
  const keys = [...new Set([...prev.metric_json, ...curr.metric_json].map((m) => m.key))];
  return keys.map((key) => {
    const p = prev.metric_json.find((m) => m.key === key)?.value ?? null;
    const c = curr.metric_json.find((m) => m.key === key)?.value ?? null;
    return { key, prev: p, curr: c, delta: waveDelta(p, c) };
  });
}
