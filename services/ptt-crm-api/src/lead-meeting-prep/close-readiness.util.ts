export type ReadinessBreakdownFactor = {
  label_vi: string;
  points: number;
  applied: boolean;
};

export function extractReadinessBreakdown(
  result: Record<string, unknown> | null | undefined,
): ReadinessBreakdownFactor[] {
  if (!result || typeof result !== 'object') return [];
  const meta = result.meta;
  if (!meta || typeof meta !== 'object') return [];
  const breakdown = (meta as Record<string, unknown>).readiness_breakdown;
  if (!Array.isArray(breakdown)) return [];
  return breakdown
    .filter((row): row is Record<string, unknown> => row != null && typeof row === 'object')
    .map((row) => ({
      label_vi: String(row.label_vi ?? ''),
      points: Number(row.points ?? 0),
      applied: Boolean(row.applied),
    }));
}

export function readinessGaugeTone(score: number | null | undefined): 'red' | 'yellow' | 'green' {
  const s = Number(score ?? 0);
  if (s < 40) return 'red';
  if (s < 70) return 'yellow';
  return 'green';
}
