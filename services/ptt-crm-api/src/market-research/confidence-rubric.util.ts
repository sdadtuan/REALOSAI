import type { ConfidenceBand, ConfidenceJson, ConfidenceRubric } from './market-research.types';

export function clampDim(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(4, Math.round(v)));
}

export function scoreRubric(r: ConfidenceRubric): number {
  return 0.25 * r.S + 0.2 * r.F + 0.25 * r.T + 0.2 * r.A + 0.1 * r.R;
}

export function bandFromScore(score: number): ConfidenceBand {
  if (score < 2) return 'low';
  if (score < 3) return 'medium';
  if (score <= 3.5) return 'high';
  return 'very_high';
}

export function applyOverrideDown(band: ConfidenceBand, overrideDown: boolean): ConfidenceBand {
  if (!overrideDown) return band;
  if (band === 'very_high') return 'high';
  if (band === 'high') return 'medium';
  if (band === 'medium') return 'low';
  return 'low';
}

export function capBandForSingleSource(band: ConfidenceBand, hasUnauditedSingleSource: boolean): ConfidenceBand {
  if (!hasUnauditedSingleSource) return band;
  if (band === 'high' || band === 'very_high') return 'medium';
  return band;
}

const FORBIDDEN = /95\s*%\s*confidence|\bMOE\b|margin of error|sai số mẫu/i;

export function assertNoFakeConfidence(rationale: string, statisticalInference: boolean): void {
  if (statisticalInference) return;
  if (FORBIDDEN.test(rationale)) {
    const err = new Error('forbidden_confidence_wording');
    (err as Error & { code: string }).code = 'forbidden_confidence_wording';
    throw err;
  }
}

export function buildConfidenceJson(input: {
  rubric: ConfidenceRubric;
  override_down?: boolean;
  single_source?: boolean;
}): ConfidenceJson {
  const rubric = {
    S: clampDim(input.rubric.S),
    F: clampDim(input.rubric.F),
    T: clampDim(input.rubric.T),
    A: clampDim(input.rubric.A),
    R: clampDim(input.rubric.R),
    statistical_inference: Boolean(input.rubric.statistical_inference),
  };
  const score = Number(scoreRubric(rubric).toFixed(2));
  let band = applyOverrideDown(bandFromScore(score), Boolean(input.override_down));
  band = capBandForSingleSource(band, Boolean(input.single_source));
  return { rubric, score, band, override_down: Boolean(input.override_down) };
}
