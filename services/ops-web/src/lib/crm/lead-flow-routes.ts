import type { LeadFlowKind } from './lead-flow-kind';

export type CrmLeadsFlowScope = 'all' | LeadFlowKind;

/** Leads for active agency clients — operational CSKH (all industries), not B2B prospecting. */
export const CRM_OPERATIONAL_LEADS_HREF = '/crm/operational/leads';
export const CRM_B2B_LEADS_HREF = '/crm/b2b/leads';
export const CRM_OPERATIONAL_LEADS_NEW_HREF = '/crm/operational/leads/new';
export const CRM_B2B_LEADS_NEW_HREF = '/crm/b2b/leads/new';
export const CRM_ALL_LEADS_HREF = '/crm/leads';

/** @deprecated Use CRM_OPERATIONAL_LEADS_HREF */
export const CRM_SPA_LEADS_HREF = CRM_OPERATIONAL_LEADS_HREF;
/** @deprecated Use CRM_OPERATIONAL_LEADS_NEW_HREF */
export const CRM_SPA_LEADS_NEW_HREF = CRM_OPERATIONAL_LEADS_NEW_HREF;

export function leadsListHref(scope: CrmLeadsFlowScope): string {
  if (scope === 'spa_operational') return CRM_OPERATIONAL_LEADS_HREF;
  if (scope === 'b2b_prospect') return CRM_B2B_LEADS_HREF;
  return CRM_ALL_LEADS_HREF;
}

export function leadsNewHref(scope: CrmLeadsFlowScope): string {
  if (scope === 'spa_operational') return CRM_OPERATIONAL_LEADS_NEW_HREF;
  if (scope === 'b2b_prospect') return CRM_B2B_LEADS_NEW_HREF;
  return '/crm/leads/new';
}

export function leadsListTitle(scope: CrmLeadsFlowScope): string {
  if (scope === 'spa_operational') return 'Lead CSKH vận hành';
  if (scope === 'b2b_prospect') return 'Lead B2B Sales';
  return 'Quản lý Lead';
}

export function leadsListSubtitle(scope: CrmLeadsFlowScope): string {
  if (scope === 'spa_operational') {
    return 'Luồng CSKH client active · Meta/ads ingest · SLA B2';
  }
  if (scope === 'b2b_prospect') return 'Luồng kinh doanh B2B · intake · đề xuất';
  return 'Tất cả leads · vận hành & B2B';
}

export function leadFlowKindQuery(scope: CrmLeadsFlowScope): LeadFlowKind | undefined {
  if (scope === 'spa_operational' || scope === 'b2b_prospect') return scope;
  return undefined;
}

export function operationalFlowPathPrefix(): string {
  return CRM_OPERATIONAL_LEADS_HREF;
}
