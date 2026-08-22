import type { MktAiCampaignDraft } from './mkt-ai-planner-api';

/** Backend strategy_framework keys (6T). */
export const STRATEGY_FIELD_ORDER = [
  'target_market',
  'market_message',
  'media_reach',
  'conversion_strategy',
  'retention_system',
  'nurture_system',
] as const;

/** TMMT prof keys aligned with lifecycle-marketing-plan.util. */
export const TMMT_PROF_FIELD_ORDER = [
  'market_context',
  'tam_sam_som',
  'geo_behavior',
  'segmentation_icp',
  'personas_roles',
  'jobs_to_be_done',
  'pains_desired_outcomes',
  'buy_triggers_obstacles',
  'criteria_vs_alternatives',
  'insights_evidence',
  'segment_priorities',
  'success_hypotheses_next',
] as const;

export const TMMT_CORE_KEYS = new Set([
  'market_context',
  'segmentation_icp',
  'personas_roles',
  'pains_desired_outcomes',
]);

export function strategyDraftSnapshot(
  strategyFramework: Record<string, string>,
  targetMarketProf: Record<string, string>,
): string {
  return JSON.stringify({ strategyFramework, targetMarketProf });
}

export function campaignsDraftSnapshot(campaigns: MktAiCampaignDraft[]): string {
  return JSON.stringify(campaigns);
}

export function contentDraftSnapshot(contentJson: Record<string, unknown>): string {
  return JSON.stringify(contentJson);
}

export function parseListField(raw: string): string[] {
  return raw
    .split(/[,;\n|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatListField(items: string[] | undefined): string {
  return (items ?? []).join(', ');
}

export function emptyCampaign(objective = 'lead'): MktAiCampaignDraft {
  return {
    name: 'Campaign mới',
    objective,
    channel_mix: [],
    budget_pct: 10,
    timeline_weeks: 'W1–W4',
    milestones: ['Brief', 'Launch'],
    kpis: [],
  };
}

export function hasStrategyContent(
  strategyFramework: Record<string, string> | undefined,
  targetMarketProf: Record<string, string> | undefined,
): boolean {
  return (
    Object.values(strategyFramework ?? {}).some((v) => String(v).trim()) ||
    Object.values(targetMarketProf ?? {}).some((v) => String(v).trim())
  );
}

export type ContentCalendarRow = {
  date: string;
  type: string;
  channel: string;
  copy: string;
};

export type ContentAdCopyRow = {
  variant: string;
  headline: string;
  body: string;
  cta: string;
};

export function normalizeContentJson(raw: Record<string, unknown> | undefined): {
  calendar: ContentCalendarRow[];
  ad_copy: ContentAdCopyRow[];
  email_sequence: string[];
} {
  const calendar = Array.isArray(raw?.calendar)
    ? (raw!.calendar as ContentCalendarRow[]).map((row) => ({
        date: String(row.date ?? ''),
        type: String(row.type ?? 'social_post'),
        channel: String(row.channel ?? ''),
        copy: String(row.copy ?? ''),
      }))
    : [];
  const ad_copy = Array.isArray(raw?.ad_copy)
    ? (raw!.ad_copy as ContentAdCopyRow[]).map((row) => ({
        variant: String(row.variant ?? ''),
        headline: String(row.headline ?? ''),
        body: String(row.body ?? ''),
        cta: String(row.cta ?? ''),
      }))
    : [];
  const email_sequence = Array.isArray(raw?.email_sequence)
    ? (raw!.email_sequence as unknown[]).map((x) => String(x))
    : [];
  return { calendar, ad_copy, email_sequence };
}

export function calendarWithinDays(rows: ContentCalendarRow[], days = 30): ContentCalendarRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + days);
  const inRange = rows.filter((row) => {
    const d = new Date(row.date);
    if (Number.isNaN(d.getTime())) return true;
    return d >= today && d <= end;
  });
  return inRange.length ? inRange : rows.slice(0, days);
}
