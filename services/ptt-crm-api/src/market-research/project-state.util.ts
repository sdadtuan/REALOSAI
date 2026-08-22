import type { ProjectStatus } from './market-research.constants';

export function canTransitionProject(
  from: ProjectStatus,
  to: ProjectStatus,
  ctx: { rqCount: number; verifiedInsightCount: number },
): { ok: true } | { ok: false; error: 'invalid_transition'; reason: string } {
  if (to === 'cancelled') return { ok: true };
  if (from === 'approved' && to !== 'distributed' && to !== 'archived') {
    return { ok: false, error: 'invalid_transition', reason: 'cannot_revert_approved' };
  }
  if (from === 'intake' && to === 'designed' && ctx.rqCount < 1) {
    return { ok: false, error: 'invalid_transition', reason: 'need_rq' };
  }
  // happy P0: intake→designed→collecting→synthesizing→drafting→in_review→approved→distributed
  const edges: Record<string, ProjectStatus[]> = {
    intake: ['designed', 'cancelled'],
    designed: ['collecting', 'cancelled'],
    collecting: ['synthesizing', 'qc', 'cancelled'],
    qc: ['analyzing', 'synthesizing', 'cancelled'],
    analyzing: ['synthesizing', 'cancelled'],
    synthesizing: ['drafting', 'cancelled'],
    drafting: ['in_review', 'cancelled'],
    in_review: ['approved', 'drafting', 'cancelled'],
    approved: ['distributed', 'archived'],
    distributed: ['archived'],
    archived: [],
    cancelled: [],
  };
  if (to === 'drafting' && from === 'synthesizing' && ctx.verifiedInsightCount < 1) {
    return { ok: false, error: 'invalid_transition', reason: 'need_verified_insight' };
  }
  if (!(edges[from] || []).includes(to)) {
    return { ok: false, error: 'invalid_transition', reason: `${from}->${to}` };
  }
  return { ok: true };
}

export function listValidTransitions(
  from: ProjectStatus,
  ctx: { rqCount: number; verifiedInsightCount: number },
): ProjectStatus[] {
  const candidates: ProjectStatus[] = [
    'intake',
    'designed',
    'collecting',
    'qc',
    'analyzing',
    'synthesizing',
    'drafting',
    'in_review',
    'approved',
    'distributed',
    'archived',
    'cancelled',
  ];
  return candidates.filter((to) => to !== from && canTransitionProject(from, to, ctx).ok);
}
