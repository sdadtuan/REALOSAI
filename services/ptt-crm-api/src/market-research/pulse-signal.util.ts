import type { TrendSignal } from './market-research.types';

export function snapshotFactDiff(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown> | null,
  keys: string[] = ['price', 'message', 'promo'],
): { changed: string[]; topic: string | null } {
  const a = prev ?? {};
  const b = next ?? {};
  const changed = keys.filter((k) => String(a[k] ?? '') !== String(b[k] ?? ''));
  return { changed, topic: changed[0] ?? null };
}

export function velocity(baseline: number | null, current: number | null): number | null {
  if (baseline == null || current == null) return null;
  if (baseline === 0) return current === 0 ? 0 : null;
  return (current - baseline) / Math.abs(baseline);
}

export function lifecycleFromVelocity(v: number | null): TrendSignal['lifecycle'] {
  if (v == null) return 'new';
  if (v > 0.15) return 'rising';
  if (v < -0.15) return 'fading';
  return 'stable';
}
