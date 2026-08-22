import type { ResearchPrefill } from './market-research.types';

export const EMPTY_RESEARCH_PREFILL: ResearchPrefill = {
  industry: null,
  competitor_names: [],
  suggested_rqs: [],
};

const EMAIL_RE = /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g;
const PHONE_RE = /(?<!\w)(?:\+?84|0)?[\s.\-]*(?:\d[\s.\-]*){8,14}\d(?!\w)/g;

export function stripPrefillPii(text: string): string {
  const cleaned = String(text ?? '').replace(EMAIL_RE, ' ').replace(PHONE_RE, ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
}

function allowedIndustry(formData: Record<string, unknown>): string | null {
  const raw = formData.industry ?? formData.niche;
  if (raw == null) return null;
  const cleaned = stripPrefillPii(String(raw));
  return cleaned || null;
}

function allowedCompetitorNames(formData: Record<string, unknown>): string[] {
  const raw = formData.top_competitors ?? formData.competitors ?? formData.competitor_names;
  if (raw == null) return [];
  return String(raw)
    .split(/[;,]/)
    .map((part) => stripPrefillPii(part))
    .filter(Boolean);
}

export function buildResearchPrefill(
  formData: Record<string, unknown> | null | undefined,
): ResearchPrefill {
  if (!formData || typeof formData !== 'object') {
    return { ...EMPTY_RESEARCH_PREFILL };
  }
  return {
    industry: allowedIndustry(formData),
    competitor_names: allowedCompetitorNames(formData),
    suggested_rqs: [],
  };
}
