import type { LeadFlowKind } from './lead-flow-kind.util';

type SqlDialect = 'postgres' | 'sqlite';

function explicitFlowExpr(dialect: SqlDialect, alias: string): string {
  const meta = `${alias}.meta_json`;
  if (dialect === 'postgres') {
    return `lower(trim(COALESCE(${meta}->>'lead_flow_kind', ${meta}->>'lead_flow', '')))`;
  }
  return `lower(trim(COALESCE(json_extract(${meta}, '$.lead_flow_kind'), json_extract(${meta}, '$.lead_flow'), '')))`;
}

function hasAgencyClientExpr(dialect: SqlDialect, alias: string): string {
  if (dialect === 'postgres') {
    return `${alias}.agency_client_id IS NOT NULL`;
  }
  return `COALESCE(json_extract(${alias}.meta_json, '$.agency_client_id'), '') <> ''`;
}

function statusExpr(alias: string): string {
  return `lower(trim(COALESCE(${alias}.status, '')))`;
}

function reProjectIdExpr(dialect: SqlDialect, alias: string): string {
  const meta = `${alias}.meta_json`;
  if (dialect === 'postgres') {
    return `trim(COALESCE(${meta}->>'re_project_id', ''))`;
  }
  return `trim(COALESCE(json_extract(${meta}, '$.re_project_id'), ''))`;
}

/** Mirrors resolveLeadFlowKind() re_buyer signals (explicit kind or re_project_id). */
export function buildReBuyerListFilter(dialect: SqlDialect, alias = 'l'): string {
  const explicit = explicitFlowExpr(dialect, alias);
  const reProjectId = reProjectIdExpr(dialect, alias);
  return `(
    ${explicit} IN ('re_buyer', 're-buyer', 'bds')
    OR ${reProjectId} <> ''
  )`;
}

/** Mirrors resolveLeadFlowKind() for list queries (presales not considered). */
export function buildSpaOperationalListFilter(dialect: SqlDialect, alias = 'l'): string {
  const explicit = explicitFlowExpr(dialect, alias);
  const hasClient = hasAgencyClientExpr(dialect, alias);
  const status = statusExpr(alias);
  const reBuyer = buildReBuyerListFilter(dialect, alias);

  return `(
    NOT ${reBuyer}
    AND (
      ${explicit} IN ('spa_operational', 'spa')
      OR (
        ${hasClient}
        AND ${explicit} NOT IN ('b2b_prospect', 'b2b')
        AND ${status} NOT IN ('won', 'proposal')
      )
    )
  )`;
}

/** Positive match for B2B — mirrors resolveLeadFlowKind() list semantics. */
export function buildB2bProspectListFilter(dialect: SqlDialect, alias = 'l'): string {
  const explicit = explicitFlowExpr(dialect, alias);
  const hasClient = hasAgencyClientExpr(dialect, alias);
  const status = statusExpr(alias);
  const reBuyer = buildReBuyerListFilter(dialect, alias);

  return `(
    NOT ${reBuyer}
    AND (
      ${explicit} IN ('b2b_prospect', 'b2b')
      OR ${status} IN ('won', 'proposal')
      OR (
        ${explicit} NOT IN ('spa_operational', 'spa')
        AND NOT (${hasClient})
      )
    )
  )`;
}

export function buildLeadFlowKindListFilter(
  kind: LeadFlowKind,
  dialect: SqlDialect,
  alias = 'l',
): string {
  if (kind === 'spa_operational') return buildSpaOperationalListFilter(dialect, alias);
  if (kind === 're_buyer') return buildReBuyerListFilter(dialect, alias);
  return buildB2bProspectListFilter(dialect, alias);
}

export interface B2bListScopeInput {
  staffId: number;
  viewAll: boolean;
  isDirector: boolean;
}

/** B2B Project OS list visibility (Task 7 / 16) — empty when view-all or director. */
export function buildB2bListScopeClause(
  dialect: SqlDialect,
  alias: string,
  scope: B2bListScopeInput,
  staffParam: string,
): string {
  if (scope.viewAll || scope.isDirector) return '';
  const b2b = buildB2bProspectListFilter(dialect, alias);
  const projectCol =
    dialect === 'postgres'
      ? `${alias}.b2b_project_id`
      : `trim(COALESCE(json_extract(${alias}.meta_json, '$.b2b_project_id'), ''))`;
  return `(
    NOT (${b2b}) OR
    ${alias}.owner_id = ${staffParam} OR
    (
      ${projectCol} IN (
        SELECT project_id FROM crm_b2b_project_staff
        WHERE staff_id = ${staffParam} AND assign_enabled
      )
      AND (${alias}.owner_id IS NULL OR ${alias}.owner_id <> ${staffParam})
    )
  )`;
}
