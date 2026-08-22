import type { MktAiBrief, MktAiDraft } from '../marketing-ai-planner/marketing-ai-planner.types';
import type { MktAiPortalSummary } from './portal-mkt-ai-summary.types';

const EXCERPT_MAX = 500;

/** Strip obvious PII patterns before exposing text on portal. */
export function redactPortalText(raw: string): string {
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\b(?:\+?84|0)\d[\d\s.-]{7,}\d\b/g, '[phone]')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pickStrategyExcerpt(
  draft: MktAiDraft | null | undefined,
  brief: MktAiBrief | null | undefined,
): string {
  const prof = draft?.target_market_prof ?? {};
  const framework = draft?.strategy_framework ?? {};
  const candidates = [
    prof.market_context,
    prof.segmentation_icp,
    framework.market_context,
    framework.market_message,
    brief?.challenges,
    brief?.brand_name ? `Thương hiệu ${brief.brand_name}` : '',
  ];
  const text = candidates.map((c) => String(c ?? '').trim()).find(Boolean) ?? '';
  const redacted = redactPortalText(text);
  if (!redacted) return '';
  return redacted.length > EXCERPT_MAX ? `${redacted.slice(0, EXCERPT_MAX - 1)}…` : redacted;
}

export function buildStaffPlannerUrl(opsWebBase: string, lifecycleId: number): string {
  const base = opsWebBase.replace(/\/$/, '');
  return `${base}/crm/service-delivery/${lifecycleId}?tab=ai-planner`;
}

export function buildMktAiPortalSummary(input: {
  lifecycleId: number;
  serviceSlug: string;
  brief: MktAiBrief | null;
  draft: MktAiDraft | null;
  qualityScore: number | null;
  playbookLabel: string | null;
  lastUpdatedAt: string;
  opsWebBaseUrl: string;
}): Omit<MktAiPortalSummary, 'ok' | 'enabled'> {
  const campaigns = input.draft?.campaigns_json ?? [];
  return {
    lifecycle_id: input.lifecycleId,
    service_slug: input.serviceSlug,
    brand_name: input.brief?.brand_name?.trim() || null,
    quality_score: input.qualityScore,
    playbook_label: input.playbookLabel,
    strategy_excerpt: pickStrategyExcerpt(input.draft, input.brief),
    campaign_count: Array.isArray(campaigns) ? campaigns.length : 0,
    last_updated_at: input.lastUpdatedAt,
    staff_planner_url: buildStaffPlannerUrl(input.opsWebBaseUrl, input.lifecycleId),
  };
}
