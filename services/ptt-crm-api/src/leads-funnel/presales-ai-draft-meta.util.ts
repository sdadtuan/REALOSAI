/** Hidden keys in target_market_prof_json — not shown in R5 strategy fields. */
export const PRESALES_AI_DRAFT_AT_KEY = '_presales_ai_draft_at';
export const PRESALES_AI_DRAFT_BY_KEY = '_presales_ai_draft_by';

export const PRESALES_AI_DRAFT_BADGE_VI = 'Bản nháp — SP duyệt';

export function stampPresalesAiDraftMeta(
  prof: Record<string, string> | undefined,
  actorEmail: string,
): Record<string, string> {
  return {
    ...(prof ?? {}),
    [PRESALES_AI_DRAFT_AT_KEY]: new Date().toISOString(),
    [PRESALES_AI_DRAFT_BY_KEY]: String(actorEmail || 'unknown').trim() || 'unknown',
  };
}

export function clearPresalesAiDraftMeta(prof: Record<string, string>): Record<string, string> {
  const next = { ...prof };
  delete next[PRESALES_AI_DRAFT_AT_KEY];
  delete next[PRESALES_AI_DRAFT_BY_KEY];
  return next;
}

export function parseTargetMarketProfJson(raw: unknown): Record<string, string> {
  try {
    return JSON.parse(String(raw ?? '{}')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function parsePresalesAiDraftMeta(prof: Record<string, string> | null | undefined): {
  is_ai_draft: boolean;
  draft_at: string | null;
  draft_by: string | null;
  badge_vi: string | null;
} {
  const at = String(prof?.[PRESALES_AI_DRAFT_AT_KEY] ?? '').trim();
  if (!at) {
    return { is_ai_draft: false, draft_at: null, draft_by: null, badge_vi: null };
  }
  return {
    is_ai_draft: true,
    draft_at: at,
    draft_by: String(prof?.[PRESALES_AI_DRAFT_BY_KEY] ?? '').trim() || null,
    badge_vi: PRESALES_AI_DRAFT_BADGE_VI,
  };
}
