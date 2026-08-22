import {
  BRIEF_FIELD_LABELS,
  type MktAiBrief,
  type MktAiBriefReadiness,
  REQUIRED_BRIEF_FIELDS,
} from './marketing-ai-planner.types';

export const BRIEF_READINESS_LOW_THRESHOLD = 70;

const OPTIONAL_BRIEF_CRITERIA = ['usp', 'competitors', 'website_url'] as const;

function fieldFilled(brief: MktAiBrief, key: string): boolean {
  const val = brief[key as keyof MktAiBrief];
  if (val == null) return false;
  if (typeof val === 'number') return Number.isFinite(val) && val > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0 && val.some((x) => String(x).trim());
  return false;
}

/** Brief readiness 0–100 — separate from plan quality score (MKTP-UC-031). */
export function computeBriefReadiness(brief: MktAiBrief | null | undefined): MktAiBriefReadiness {
  const b = brief ?? {};
  const criteria: Record<string, boolean> = {};
  const missing: string[] = [];
  const messages: string[] = [];

  for (const key of REQUIRED_BRIEF_FIELDS) {
    const ok = fieldFilled(b, key);
    criteria[key] = ok;
    if (!ok) {
      missing.push(key);
      messages.push(`Thiếu ${BRIEF_FIELD_LABELS[key] ?? key}.`);
    }
  }

  for (const key of OPTIONAL_BRIEF_CRITERIA) {
    criteria[key] = fieldFilled(b, key);
  }

  const requiredWeight = 12;
  const optionalWeight = 5;
  let score = 0;
  for (const key of REQUIRED_BRIEF_FIELDS) {
    if (criteria[key]) score += requiredWeight;
  }
  for (const key of OPTIONAL_BRIEF_CRITERIA) {
    if (criteria[key]) score += optionalWeight;
  }

  const maxScore = REQUIRED_BRIEF_FIELDS.length * requiredWeight + OPTIONAL_BRIEF_CRITERIA.length * optionalWeight;
  const normalized = Math.round((score / maxScore) * 100);

  if (normalized < BRIEF_READINESS_LOW_THRESHOLD) {
    messages.unshift(`Brief readiness ${normalized}/100 — khuyến nghị ≥${BRIEF_READINESS_LOW_THRESHOLD} trước pipeline AI.`);
  }

  return {
    score: normalized,
    criteria,
    messages,
    missing,
    low_threshold: BRIEF_READINESS_LOW_THRESHOLD,
  };
}
