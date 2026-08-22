import { LeadRouteCandidate, LeadRouteContext, LeadRouteEngineResult, LeadRouteStrategy } from './lead-route.types';

function channelKeyword(channel: string | null, source: string | null): string {
  return String(channel ?? source ?? '')
    .trim()
    .toLowerCase();
}

function roleMatchScore(candidate: LeadRouteCandidate, keyword: string): number {
  if (!keyword) return 0.5;
  const role = String(candidate.role).toLowerCase();
  if (keyword === 'meta' || keyword === 'facebook') {
    return role === 'marketing' ? 1 : role === 'sales' ? 0.75 : 0.4;
  }
  if (keyword === 'zalo') {
    return role === 'cskh' ? 1 : role === 'sales' ? 0.8 : 0.45;
  }
  return role === 'sales' ? 0.85 : 0.5;
}

function loadScore(openLeads: number): number {
  return 1 / (1 + Math.max(openLeads, 0) * 0.15);
}

function scoreCandidate(
  candidate: LeadRouteCandidate,
  ctx: LeadRouteContext,
  keyword: string,
): number {
  const role = roleMatchScore(candidate, keyword);
  const load = loadScore(candidate.open_leads);
  const scoreNorm =
    ctx.leadScore != null ? Math.min(1, Math.max(0, ctx.leadScore / 100)) : 0.45;
  const projectBonus = ctx.reProjectId || ctx.b2bProjectId ? 0.08 : 0;
  const bandBonus =
    ctx.scoreBand === 'hot' ? 0.06 : ctx.scoreBand === 'warm' ? 0.03 : 0;
  return role * 0.35 + load * 0.35 + scoreNorm * 0.2 + projectBonus + bandBonus;
}

/** RNOS-26 ML v1 — feature-weighted rep ranking (lead-route-ml-v1). */
export function computeLeadRouteMlV1(ctx: LeadRouteContext): LeadRouteEngineResult | null {
  if (!ctx.candidates.length) {
    return null;
  }

  const keyword = channelKeyword(ctx.channel, ctx.source);
  let strategy: LeadRouteStrategy = ctx.reProjectId ? 'project_pool' : 'global_round_robin';
  if (keyword === 'meta' || keyword === 'facebook' || keyword === 'zalo') {
    strategy = 'source_match';
  }

  const ranked = ctx.candidates
    .map((candidate) => ({
      candidate,
      mlScore: scoreCandidate(candidate, ctx, keyword),
    }))
    .sort((a, b) => b.mlScore - a.mlScore);

  const picked = ranked[0]?.candidate;
  if (!picked) return null;

  const mlScore = ranked[0]?.mlScore ?? 0.5;
  let confidence = 0.62 + mlScore * 0.28;
  if (picked.open_leads === 0) confidence += 0.04;
  confidence = Math.min(0.95, Math.round(confidence * 1000) / 1000);

  const channelLabel = keyword || 'CRM';
  const scorePart =
    ctx.leadScore != null
      ? ` · điểm ${Math.round(ctx.leadScore)}/100 (${ctx.scoreBand ?? '—'})`
      : '';
  const projectPart =
    ctx.reProjectId
      ? ` · pool dự án #${ctx.reProjectId}`
      : ctx.b2bProjectId
        ? ` · pool dự án B2B`
        : ' · pool toàn team';

  const reason = `[ML v1] Phân cho ${picked.staff_name} (${picked.staff_code || picked.role}) — nguồn ${channelLabel}${scorePart}${projectPart}. Load ${picked.open_leads} lead · score ML ${(mlScore * 100).toFixed(0)}.`;

  return {
    recommendedStaffId: picked.staff_id,
    recommendedStaffName: picked.staff_name,
    recommendedStaffCode: picked.staff_code,
    strategy,
    reason,
    confidence,
    ruleId: 'route_ml_v1',
    projectId: ctx.reProjectId,
    alternatives: ranked.slice(1, 4).map((row) => row.candidate),
  };
}
