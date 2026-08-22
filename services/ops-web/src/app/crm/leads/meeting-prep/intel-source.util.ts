import type { LeadMeetingPrepResult } from './lead-meeting-prep.types';

export type IntelSourceBadge = {
  label: string;
  tone: 'live' | 'partial' | 'stub';
  detail?: string;
};

export function getIntelSourceBadge(result: LeadMeetingPrepResult | undefined): IntelSourceBadge {
  const meta = result?.meta;
  const credits = Number(meta?.tavily_credits_used ?? 0);
  const sources = Number(meta?.sources_count ?? 0);
  const partial = Boolean(meta?.partial_collect);
  const apifyRuns = Number(meta?.apify_runs ?? 0);
  const socialCount = Array.isArray(result?.social_channels) ? result!.social_channels!.length : 0;

  const apifyNote =
    apifyRuns > 0 && socialCount > 0
      ? ` · Apify FB (${socialCount} kênh)`
      : apifyRuns > 0
        ? ' · Apify đã chạy'
        : '';

  if (credits > 0 && sources > 0) {
    return {
      label: partial ? 'Intel Tavily (một phần)' : 'Intel Tavily live',
      tone: partial ? 'partial' : 'live',
      detail: `${credits} credit · ${sources} nguồn${apifyNote}`,
    };
  }

  if (apifyRuns > 0 && socialCount > 0) {
    return {
      label: 'Intel Apify FB',
      tone: 'partial',
      detail: `${socialCount} social snapshot · ${apifyRuns} run`,
    };
  }

  return {
    label: 'Intel stub — chưa có Tavily',
    tone: 'stub',
    detail: 'Chạy lại prep sau khi Ops bật TAVILY_API_KEY',
  };
}
