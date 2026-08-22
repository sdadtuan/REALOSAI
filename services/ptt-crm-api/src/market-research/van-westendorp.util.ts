import { assertNoFakeConfidence } from './confidence-rubric.util';
import {
  VW_BASES,
  VW_LIMITATION,
  type VwBase,
  type VwBin,
  type VwPoints,
  type VwRespondent,
  type VwSummary,
} from './market-research.types';

function coded(code: string): never {
  throw Object.assign(new Error(code), { code });
}

const LOCATOR_RE = /^R-(.+):(too_cheap|cheap|expensive|too_expensive)$/;

function isPositiveFinite(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function isOrdered(r: VwRespondent): boolean {
  return r.too_cheap <= r.cheap && r.cheap <= r.expensive && r.expensive <= r.too_expensive;
}

export function respondentsFromVwEvidence(
  rows: Array<{ value_num: number | null; value_base: string; locator: string }>,
): VwRespondent[] {
  const groups = new Map<string, Partial<VwRespondent>>();
  for (const row of rows) {
    const match = String(row.locator ?? '').trim().match(LOCATOR_RE);
    if (!match) continue;
    const base = match[2] as VwBase;
    if (!VW_BASES.includes(base)) continue;
    const id = match[1];
    const current = groups.get(id) ?? {};
    current[base] = row.value_num == null ? Number.NaN : Number(row.value_num);
    groups.set(id, current);
  }

  const out: VwRespondent[] = [];
  for (const partial of groups.values()) {
    const respondent: VwRespondent = {
      too_cheap: Number(partial.too_cheap),
      cheap: Number(partial.cheap),
      expensive: Number(partial.expensive),
      too_expensive: Number(partial.too_expensive),
    };
    if (
      !isPositiveFinite(respondent.too_cheap) ||
      !isPositiveFinite(respondent.cheap) ||
      !isPositiveFinite(respondent.expensive) ||
      !isPositiveFinite(respondent.too_expensive)
    ) {
      continue;
    }
    if (!isOrdered(respondent)) continue;
    out.push(respondent);
  }
  return out;
}

export function firstCrossing(xs: number[], a: number[], b: number[]): number | null {
  if (xs.length < 1 || a.length !== xs.length || b.length !== xs.length) return null;
  for (let i = 0; i < xs.length - 1; i += 1) {
    const d0 = a[i] - b[i];
    const d1 = a[i + 1] - b[i + 1];
    if (d0 === 0) return xs[i];
    if (d0 * d1 < 0) {
      return xs[i] + (xs[i + 1] - xs[i]) * (d0 / (d0 - d1));
    }
  }
  if (a[xs.length - 1] === b[xs.length - 1]) return xs[xs.length - 1];
  return null;
}

export function computeVanWestendorp(respondents: VwRespondent[]): Omit<VwSummary, 'unit'> {
  const n = respondents.length;
  if (n < 4) coded('vw_insufficient_n');

  const prices = [
    ...new Set(
      respondents.flatMap((r) => [r.too_cheap, r.cheap, r.expensive, r.too_expensive]),
    ),
  ].sort((x, y) => x - y);

  const bins: VwBin[] = prices.map((price) => ({
    price,
    too_cheap: (100 * respondents.filter((r) => r.too_cheap >= price).length) / n,
    cheap: (100 * respondents.filter((r) => r.cheap >= price).length) / n,
    expensive: (100 * respondents.filter((r) => r.expensive <= price).length) / n,
    too_expensive: (100 * respondents.filter((r) => r.too_expensive <= price).length) / n,
  }));

  const xs = bins.map((bin) => bin.price);
  const tooCheap = bins.map((bin) => bin.too_cheap);
  const cheap = bins.map((bin) => bin.cheap);
  const expensive = bins.map((bin) => bin.expensive);
  const tooExpensive = bins.map((bin) => bin.too_expensive);

  const points: VwPoints = {
    idp: firstCrossing(xs, cheap, expensive),
    opp: firstCrossing(xs, tooCheap, tooExpensive),
    pmc: firstCrossing(xs, tooCheap, expensive),
    pme: firstCrossing(xs, cheap, tooExpensive),
  };

  const out: Omit<VwSummary, 'unit'> = {
    n,
    bins,
    points,
    limitation_note: VW_LIMITATION,
    statistical_inference: false,
  };
  // limitation_note is the prescribed disclaimer and contains "MOE" / "95% confidence";
  // assert the numeric payload only so BR-RES-03 still holds on bins/points.
  assertNoFakeConfidence(JSON.stringify({ n: out.n, bins: out.bins, points: out.points }), false);
  return out;
}
