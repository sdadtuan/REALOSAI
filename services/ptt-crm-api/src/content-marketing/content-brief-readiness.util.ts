export type BriefReadinessResult =
  | { ok: true }
  | { ok: false; missing_fields: Array<'audience' | 'goal'> };

export function resolveBriefAudience(
  brandContext: Record<string, unknown>,
  briefJson?: Record<string, unknown> | null,
): string {
  const fromBrief = briefJson?.audience ?? briefJson?.target_audience;
  if (fromBrief != null) {
    if (Array.isArray(fromBrief)) {
      return fromBrief.map((x) => String(x).trim()).filter(Boolean).join(', ');
    }
    return String(fromBrief).trim();
  }
  const aud = brandContext.audience;
  if (Array.isArray(aud)) {
    return aud.map((x) => String(x).trim()).filter(Boolean).join(', ');
  }
  return String(aud ?? '').trim();
}

export function resolveBriefGoal(
  item: { funnel_goal?: string | null; brief_json?: Record<string, unknown> | null },
  inputGoal?: string | null,
): string {
  const goal = inputGoal ?? item.funnel_goal ?? item.brief_json?.goal ?? item.brief_json?.target_goal;
  return goal != null ? String(goal).trim() : '';
}

export function assessBriefReadiness(
  item: { funnel_goal?: string | null; brief_json?: Record<string, unknown> | null },
  brandContext: Record<string, unknown>,
  inputGoal?: string | null,
): BriefReadinessResult {
  const missing: Array<'audience' | 'goal'> = [];
  if (!resolveBriefGoal(item, inputGoal)) missing.push('goal');
  if (!resolveBriefAudience(brandContext, item.brief_json)) missing.push('audience');
  return missing.length ? { ok: false, missing_fields: missing } : { ok: true };
}
