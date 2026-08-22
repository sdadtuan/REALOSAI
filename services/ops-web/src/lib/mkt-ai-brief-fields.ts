import type { MktAiBrief } from '@/lib/mkt-ai-planner-api';

/** Matches BE REQUIRED_BRIEF_FIELDS order — used for scroll-to-first-error. */
export const BRIEF_REQUIRED_FIELD_ORDER = [
  'brand_name',
  'industry',
  'service_slug',
  'objective',
  'budget_monthly_vnd',
  'geo_markets',
  'challenges',
] as const;

export type BriefFieldKey = (typeof BRIEF_REQUIRED_FIELD_ORDER)[number];

export function formatBriefVnd(n: number | undefined): string {
  if (!n || !Number.isFinite(n)) return '';
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function parseBriefVnd(raw: string): number | undefined {
  const n = Number(String(raw).replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function normalizeBriefForSave(
  brief: MktAiBrief,
  serviceSlug?: string,
): MktAiBrief {
  return {
    ...brief,
    service_slug: brief.service_slug ?? serviceSlug ?? '',
  };
}

export function briefAutosaveSnapshot(brief: MktAiBrief, serviceSlug?: string): string {
  return JSON.stringify(normalizeBriefForSave(brief, serviceSlug));
}
