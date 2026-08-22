import { assertNoInsightTextLeak, freezePlanInsights } from './plan-insight-snapshot.util';

export { assertNoInsightTextLeak };

export const freezeContentInsights = freezePlanInsights;

export const CONTENT_RESEARCH_BRIEF_KEY = 'market_research';

export function stripContentResearchFromBrief(
  brief: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const next = { ...(brief ?? {}) };
  delete next[CONTENT_RESEARCH_BRIEF_KEY];
  return next;
}
