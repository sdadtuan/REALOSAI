import { LeadRouteCandidate, LeadRouteContext, LeadRouteEngineResult, LeadRouteStrategy } from './lead-route.types';

function channelKeyword(channel: string | null, source: string | null): string {
  return String(channel ?? source ?? '')
    .trim()
    .toLowerCase();
}

function pickLowestLoad(candidates: LeadRouteCandidate[]): LeadRouteCandidate | null {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => {
    if (a.open_leads !== b.open_leads) return a.open_leads - b.open_leads;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  })[0];
}

function filterBySource(candidates: LeadRouteCandidate[], keyword: string): LeadRouteCandidate[] {
  if (!keyword) return candidates;
  const preferredRoles =
    keyword === 'meta' || keyword === 'facebook'
      ? ['sales', 'marketing']
      : keyword === 'zalo'
        ? ['sales', 'cskh']
        : ['sales'];
  const matched = candidates.filter((c) => preferredRoles.includes(String(c.role).toLowerCase()));
  return matched.length ? matched : candidates;
}

/** RNOS-26 — rules v1 lead routing (no ML). */
export function computeLeadRouteV1(ctx: LeadRouteContext): LeadRouteEngineResult | null {
  if (!ctx.candidates.length) {
    return null;
  }

  const keyword = channelKeyword(ctx.channel, ctx.source);
  let strategy: LeadRouteStrategy = ctx.reProjectId ? 'project_pool' : 'global_round_robin';
  let pool = ctx.candidates;

  if (keyword && (keyword === 'meta' || keyword === 'facebook' || keyword === 'zalo')) {
    const narrowed = filterBySource(pool, keyword);
    if (narrowed.length) {
      pool = narrowed;
      strategy = ctx.reProjectId ? 'source_match' : 'source_match';
    }
  }

  const picked = pickLowestLoad(pool);
  if (!picked) return null;

  const channelLabel = keyword || 'CRM';
  const scorePart =
    ctx.leadScore != null
      ? ` · điểm ${Math.round(ctx.leadScore)}/100 (${ctx.scoreBand ?? '—'})`
      : '';
  const projectPart = ctx.reProjectId ? ` · pool dự án #${ctx.reProjectId}` : ' · pool toàn team';

  let confidence = 0.68;
  if (ctx.reProjectId) confidence += 0.12;
  if (ctx.leadScore != null && ctx.leadScore >= 70) confidence += 0.08;
  if (picked.open_leads === 0) confidence += 0.05;
  confidence = Math.min(0.92, confidence);

  const reason = `Gợi ý phân cho ${picked.staff_name} (${picked.staff_code || picked.role}) — nguồn ${channelLabel}${scorePart}${projectPart}. NV đang mở ${picked.open_leads} lead.`;

  const alternatives = pool
    .filter((c) => c.staff_id !== picked.staff_id)
    .slice(0, 3);

  return {
    recommendedStaffId: picked.staff_id,
    recommendedStaffName: picked.staff_name,
    recommendedStaffCode: picked.staff_code,
    strategy,
    reason,
    confidence,
    ruleId: `route_v1_${strategy}`,
    projectId: ctx.reProjectId,
    alternatives,
  };
}
