import { normalizeCatalogSlug } from '../../catalog/catalog-slug.util';

const WILDCARD = '*';

export interface AssignScopeRowLite {
  staff_id: number;
  industry_slug: string;
  service_slug: string;
  active: boolean;
}

export function leadAssignmentPoolKey(industrySlug: string, serviceSlug: string): string {
  const ind = normalizeCatalogSlug(industrySlug) || WILDCARD;
  const svc = normalizeCatalogSlug(serviceSlug) || WILDCARD;
  return `lead_rr:ind:${ind}:svc:${svc}`;
}

function scopeMatches(
  leadInd: string,
  leadSvc: string,
  rowInd: string,
  rowSvc: string,
): boolean {
  const ri = rowInd && rowInd !== WILDCARD ? normalizeCatalogSlug(rowInd) || WILDCARD : WILDCARD;
  const rs = rowSvc && rowSvc !== WILDCARD ? normalizeCatalogSlug(rowSvc) || WILDCARD : WILDCARD;
  const li = leadInd ? normalizeCatalogSlug(leadInd) || WILDCARD : WILDCARD;
  const ls = leadSvc ? normalizeCatalogSlug(leadSvc) || WILDCARD : WILDCARD;
  return (ri === WILDCARD || ri === li) && (rs === WILDCARD || rs === ls);
}

/** null = no scopes configured (all active staff eligible). */
export function eligibleStaffIdsForLead(
  scopes: AssignScopeRowLite[],
  industrySlug: string,
  serviceSlug: string,
): Set<number> | null {
  const active = scopes.filter((row) => row.active);
  if (!active.length) return null;
  const matched = new Set<number>();
  for (const row of active) {
    if (scopeMatches(industrySlug, serviceSlug, row.industry_slug, row.service_slug)) {
      matched.add(row.staff_id);
    }
  }
  return matched;
}

export function pickRoundRobinStaffId(
  candidateIds: number[],
  poolKey: string,
  assignmentState: Array<{ pool_key: string; last_staff_id: number }>,
): number {
  const ids = [...new Set(candidateIds)].sort((a, b) => a - b);
  if (!ids.length) {
    throw new Error('no_candidates');
  }
  const lastId = Number(
    assignmentState.find((row) => row.pool_key === poolKey)?.last_staff_id ?? 0,
  );
  const idx = ids.indexOf(lastId);
  return ids[(idx + 1) % ids.length] ?? ids[0];
}
