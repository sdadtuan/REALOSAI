import { BadRequestException } from '@nestjs/common';

const SPLIT_TOLERANCE = 0.01;

export function assertSplitsSum100(splits: { pct: number }[]): void {
  const sum = splits.reduce((acc, row) => acc + Number(row.pct ?? 0), 0);
  if (Math.abs(sum - 100) > SPLIT_TOLERANCE) {
    throw new BadRequestException({ error: 'split_sum' });
  }
}

export function pickSchemeTier(
  rows: { min_score: number; pct: number; id?: string; min_tier_id?: string }[],
  agencyMinScore: number,
): { min_score: number; pct: number; id?: string; min_tier_id?: string } | null {
  const eligible = rows.filter((row) => Number(row.min_score) <= agencyMinScore);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, row) =>
    Number(row.min_score) > Number(best.min_score) ? row : best,
  );
}

export function computeLineAmount(baseVnd: number, pct: number, splitPct: number): number {
  return Math.round((baseVnd * pct) / 100 * (splitPct / 100));
}

export function computeStatementNet(input: {
  grossVnd: number;
  advanceVnd: number;
  clawbackVnd: number;
}): number {
  return input.grossVnd - input.advanceVnd - input.clawbackVnd;
}

export function periodMonthStart(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function clampTierMove(
  tiers: { id: string; min_score: number }[],
  currentTierId: string | null,
  desiredTierId: string,
): string {
  const sorted = [...tiers].sort((a, b) => a.min_score - b.min_score);
  const currentIdx = sorted.findIndex((t) => t.id === currentTierId);
  const desiredIdx = sorted.findIndex((t) => t.id === desiredTierId);
  if (desiredIdx < 0) return currentTierId ?? desiredTierId;
  if (currentIdx < 0) return desiredTierId;
  if (desiredIdx > currentIdx + 1) return sorted[currentIdx + 1].id;
  if (desiredIdx < currentIdx - 1) return sorted[currentIdx - 1].id;
  return desiredTierId;
}

export function pickTierByScore(
  tiers: { id: string; min_score: number }[],
  totalScore: number,
): { id: string; min_score: number } | null {
  const eligible = tiers.filter((t) => t.min_score <= totalScore);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, t) => (t.min_score > best.min_score ? t : best));
}
