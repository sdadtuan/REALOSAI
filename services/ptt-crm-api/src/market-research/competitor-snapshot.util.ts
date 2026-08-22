import { COMPETITOR_FACT_KEYS, type CompetitorFact } from './market-research.types';

export function sanitizeCompetitorFact(raw: unknown): CompetitorFact {
  const out: CompetitorFact = {};
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  for (const key of COMPETITOR_FACT_KEYS) {
    if (obj[key] !== undefined && obj[key] !== null && String(obj[key]).trim() !== '') {
      out[key] = typeof obj[key] === 'number' ? obj[key] : String(obj[key]).slice(0, 500);
    }
  }
  return out;
}

export function assertPaidEstimateTier(input: {
  publisher?: string | null;
  url?: string | null;
  reliability_tier: string;
  limitation_note?: string | null;
}): void {
  const hay = `${input.publisher ?? ''} ${input.url ?? ''}`.toLowerCase();
  const paid = /similarweb|semrush|sparktoro|talkwalker/.test(hay);
  if (!paid) return;
  if (!['low', 'medium'].includes(input.reliability_tier)) {
    throw Object.assign(new Error('reliability_capped'), { code: 'reliability_capped' });
  }
  if (!String(input.limitation_note || '').trim()) {
    throw Object.assign(new Error('limitation_required'), { code: 'limitation_required' });
  }
}

export const assertSimilarwebTier = assertPaidEstimateTier;
