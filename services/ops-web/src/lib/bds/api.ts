import { API_BASE } from '@/lib/api';
import { bdsActionErrorMessage, type BdsG0Status } from './g0-copy';
import type {
  BdsAgency,
  BdsAgingRow,
  BdsBasketUnit,
  BdsBuyerRow,
  BdsSpineBuyer,
  BdsCommissionLedger,
  BdsCommissionScheme,
  BdsCommissionStatement,
  BdsHdmbGate,
  BdsHoldRow,
  BdsHoldStatus,
  BdsImportResult,
  BdsSchemeBase,
  BdsSchemeSplitInput,
  BdsSchemeTierInput,
  BdsLegalDoc,
  BdsMilestone,
  BdsPhase,
  BdsPlanRevision,
  BdsPolicy,
  BdsPriceList,
  BdsStack,
  BdsTower,
  BdsTxRow,
  BdsUnit,
  HubResponse,
  LeaderboardRow,
} from './types';

export type {
  BdsAgingRow,
  BdsBuyerRow,
  BdsHdmbGate,
  BdsHoldRow,
  BdsHoldStatus,
  BdsSpineBuyer,
  BdsTxRow,
  HubResponse,
  LeaderboardRow,
};

const TENANT_STORAGE_KEY = 'bds-tenant-id';
const MODE_STORAGE_KEY = 'bds-tenant-mode';

export function setBdsTenantId(id: string): void {
  if (typeof window === 'undefined') return;
  const trimmed = String(id ?? '').trim();
  if (trimmed) window.localStorage.setItem(TENANT_STORAGE_KEY, trimmed);
}

export function getBdsTenantId(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_BDS_TENANT_ID ?? '').trim();
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(TENANT_STORAGE_KEY)?.trim();
    if (stored) return stored;
    if (fromEnv) {
      window.localStorage.setItem(TENANT_STORAGE_KEY, fromEnv);
      return fromEnv;
    }
  }
  return fromEnv;
}

export function setBdsTenantMode(mode: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(MODE_STORAGE_KEY, mode);
}

export function getBdsTenantMode(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(MODE_STORAGE_KEY);
}

async function bdsFetch<T>(
  token: string,
  path: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
      ...extraHeaders,
    },
  });
  if (!res.ok) {
    throw new Error(`BDS ${path} → ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export type BdsTenantMe = {
  id: string;
  code: string;
  name: string;
  mode: 'developer' | 'broker' | 'hybrid';
  status: string;
};

export async function fetchBdsTenantMe(token: string): Promise<BdsTenantMe> {
  const me = await bdsFetch<BdsTenantMe>(token, '/api/v1/bds/tenants/me');
  setBdsTenantId(me.id);
  setBdsTenantMode(me.mode);
  return me;
}

export async function fetchBdsG0(token: string): Promise<BdsG0Status> {
  return bdsFetch<BdsG0Status>(token, '/api/v1/bds/org/g0');
}

export type BdsStaffKpiMetric = { key: string; label: string; value: number; target?: number | null };

export async function fetchBdsStaffKpiMetrics(
  token: string,
  staffId: number,
  params?: { year?: number; month?: number },
): Promise<{ metrics: BdsStaffKpiMetric[] }> {
  const qs = new URLSearchParams();
  if (params?.year != null) qs.set('year', String(params.year));
  if (params?.month != null) qs.set('month', String(params.month));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return bdsFetch(token, `/api/v1/bds/kpi/staff/${staffId}/metrics${suffix}`);
}

export async function fetchBdsHub(token: string): Promise<HubResponse> {
  return bdsFetch<HubResponse>(token, '/api/v1/bds/hub');
}

export async function fetchBdsLeaderboard(token: string, period?: string): Promise<LeaderboardRow[]> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : '';
  return bdsFetch<LeaderboardRow[]>(token, `/api/v1/bds/leaderboard${qs}`);
}

export async function fetchBdsAgencies(token: string): Promise<BdsAgency[]> {
  return bdsFetch(token, '/api/v1/bds/agencies');
}

export async function fetchBdsMeBasket(token: string): Promise<{ items: unknown[] }> {
  return bdsFetch(token, '/api/v1/bds/me/basket');
}

export async function fetchBdsCommissions(
  token: string,
  agencyId: string,
  period: string,
): Promise<BdsCommissionLedger[]> {
  const qs = new URLSearchParams({ agency_id: agencyId, period });
  return bdsFetch(token, `/api/v1/bds/commissions?${qs.toString()}`);
}

export type AftersalesBoardRow = {
  transaction_id: string;
  project_id: number;
  product_id: number;
  stage: string;
  contract_no: string;
  handover_appointment_at: string | null;
  appointment_due: boolean;
  title_status: string;
  checks_passed: number;
  checks_total: number;
  open_defects: number;
};

async function bdsMutate<T>(
  token: string,
  path: string,
  method: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
      ...extraHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    throw new Error(bdsActionErrorMessage(res.status, body, `BDS ${path} → ${res.status}`));
  }
  return res.json() as Promise<T>;
}

export function fetchProjectHolds(token: string, projectId: number) {
  return bdsFetch<BdsHoldRow[]>(token, `/api/v1/bds/projects/${projectId}/holds`);
}

export function postUnitHold(
  token: string,
  unitId: number,
  body: { lead_id: number; row_version: number; channel_partner_id?: string; note?: string },
  idempotencyKey: string,
) {
  return bdsMutate<BdsHoldRow>(
    token,
    `/api/v1/bds/units/${unitId}/holds`,
    'POST',
    body,
    { 'idempotency-key': idempotencyKey },
  );
}

export function postHoldApprove(token: string, id: string, approved_by: string) {
  return bdsMutate<BdsHoldRow>(token, `/api/v1/bds/holds/${id}/approve`, 'POST', { approved_by });
}

export function postHoldReject(token: string, id: string, reason: string) {
  return bdsMutate<BdsHoldRow>(token, `/api/v1/bds/holds/${id}/reject`, 'POST', { reason });
}

export function postHoldCancel(token: string, id: string, reason: string) {
  return bdsMutate<BdsHoldRow>(token, `/api/v1/bds/holds/${id}/cancel`, 'POST', { reason });
}

export function fetchProjectTransactions(token: string, projectId: number) {
  return bdsFetch<BdsTxRow[]>(token, `/api/v1/bds/projects/${projectId}/transactions`);
}

export function fetchHdmbGate(token: string, txId: string) {
  return bdsFetch<BdsHdmbGate>(token, `/api/v1/bds/transactions/${txId}/hdmb-gate`);
}

export function postConvertDeposit(
  token: string,
  holdId: string,
  body: { deposit_vnd: number; policy_id: string; row_version: number },
  idempotencyKey: string,
) {
  return bdsMutate<BdsTxRow>(
    token,
    `/api/v1/bds/holds/${holdId}/convert-deposit`,
    'POST',
    body,
    { 'idempotency-key': idempotencyKey },
  );
}

export function postTxVbtt(token: string, txId: string, vbtt_no: string) {
  return bdsMutate<BdsTxRow>(token, `/api/v1/bds/transactions/${txId}/vbtt`, 'POST', { vbtt_no });
}

export function postTxContract(
  token: string,
  txId: string,
  body: { contract_no: string; row_version: number },
) {
  return bdsMutate<BdsTxRow>(token, `/api/v1/bds/transactions/${txId}/contract`, 'POST', body);
}

function isPositiveProjectId(projectId: number): boolean {
  return Number.isInteger(projectId) && projectId > 0;
}

export async function fetchBdsLeads(token: string, projectId: number): Promise<BdsBuyerRow[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch<BdsBuyerRow[]>(token, `/api/v1/bds/leads?project_id=${projectId}`);
}

export async function fetchBdsSpineBuyer(token: string, leadId: number): Promise<BdsSpineBuyer> {
  return bdsFetch<BdsSpineBuyer>(token, `/api/v1/bds/spine/buyer/${leadId}`);
}

export function postLeadQualify(token: string, id: number, status: string) {
  return bdsMutate<BdsBuyerRow>(token, `/api/v1/bds/leads/${id}/qualify`, 'POST', { status });
}

export function postLeadTouch(token: string, id: number) {
  return bdsMutate<BdsBuyerRow>(token, `/api/v1/bds/leads/${id}/touch`, 'POST', {});
}

export function postLeadVisit(
  token: string,
  id: number,
  body: { scheduled_at: string; staff_id: number; note?: string },
) {
  return bdsMutate<unknown>(token, `/api/v1/bds/leads/${id}/visits`, 'POST', body);
}

export function postReceipt(
  token: string,
  body: {
    transaction_id: string;
    amount_vnd: number;
    method: 'bank' | 'cash' | 'loan';
    paid_at?: string;
    note?: string;
  },
) {
  return bdsMutate<unknown>(token, '/api/v1/bds/receipts', 'POST', body);
}

export async function fetchCollectionAging(token: string, projectId: number): Promise<BdsAgingRow[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch<BdsAgingRow[]>(token, `/api/v1/bds/collections/aging?project_id=${projectId}`);
}

export async function downloadCollectionExport(token: string, projectId: number): Promise<void> {
  if (!isPositiveProjectId(projectId)) return;
  const path = `/api/v1/bds/collections/export?project_id=${projectId}`;
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${path}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bds-receipts.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadHdqtExport(token: string): Promise<void> {
  const path = '/api/v1/bds/hub/export?kind=hdqt';
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${path}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bds-hdqt.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchBdsAftersales(
  token: string,
  projectId?: number,
): Promise<AftersalesBoardRow[]> {
  const qs = projectId != null ? `?project_id=${projectId}` : '';
  return bdsFetch(token, `/api/v1/bds/aftersales${qs}`);
}

export function postHandoverCheck(token: string, txId: string, item_code: string, status: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/handover-check`, 'POST', {
    item_code,
    status,
  });
}

export function postHandover(
  token: string,
  txId: string,
  waive?: boolean,
  waive_reason?: string,
) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/handover`, 'POST', {
    waive,
    waive_reason,
  });
}

export function postTitle(token: string, txId: string, title_status: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/title`, 'POST', { title_status });
}

export function postDefect(token: string, txId: string, title: string) {
  return bdsMutate(token, `/api/v1/bds/transactions/${txId}/defects`, 'POST', {
    kind: 'defect',
    title,
  });
}

export type LaunchRow = {
  id: string;
  project_id: number;
  phase_id: string | null;
  hold_ttl_seconds: number;
  price_list_id: number | null;
  status: 'draft' | 'open' | 'closed';
  opened_at: string | null;
  closed_at: string | null;
};

export async function fetchBdsLaunches(token: string, projectId?: number): Promise<LaunchRow[]> {
  const qs = projectId != null ? `?project_id=${projectId}` : '';
  return bdsFetch(token, `/api/v1/bds/launches${qs}`);
}

export async function fetchBdsWarRoom(
  token: string,
  launchId: string,
): Promise<{
  launch: LaunchRow;
  holds: Array<{
    hold_id: string;
    product_id: number;
    lead_id: number;
    status: string;
    expires_at: string | null;
    ttl_remaining_sec: number | null;
  }>;
  queues: Array<{ id: string; product_id: number; lead_id: number; status: string }>;
  conflicts: Array<{ product_id: number; waiting: number }>;
}> {
  return bdsFetch(token, `/api/v1/bds/launches/${launchId}/war-room`);
}

export function postOpenLaunch(token: string, id: string) {
  return bdsMutate(token, `/api/v1/bds/launches/${id}/open`, 'POST', {});
}

export function postCloseLaunch(token: string, id: string) {
  return bdsMutate(token, `/api/v1/bds/launches/${id}/close`, 'POST', {});
}

// --- W2: Project OS ---

export async function fetchProjectTowers(token: string, projectId: number): Promise<BdsTower[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/towers`);
}

export function postProjectTower(
  token: string,
  projectId: number,
  body: { code: string; name: string },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/towers`, 'POST', body);
}

export async function fetchProjectLegalDocs(token: string, projectId: number): Promise<BdsLegalDoc[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/legal-docs`);
}

export function postProjectLegalDoc(
  token: string,
  projectId: number,
  body: { doc_type: string; status: string; file_id?: string; issued_on?: string; expires_on?: string },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/legal-docs`, 'POST', body);
}

export function postLegalGate(
  token: string,
  projectId: number,
  body?: { override?: boolean; reason?: string },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/legal-gate`, 'POST', body ?? {});
}

export async function fetchProjectPhases(token: string, projectId: number): Promise<BdsPhase[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/phases`);
}

export function postProjectPhase(
  token: string,
  projectId: number,
  body: { code: string; name: string },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/phases`, 'POST', body);
}

export function postPhaseOpen(token: string, phaseId: string) {
  return bdsMutate(token, `/api/v1/bds/phases/${phaseId}/open`, 'POST', {});
}

export function postPhaseClose(token: string, phaseId: string) {
  return bdsMutate(token, `/api/v1/bds/phases/${phaseId}/close`, 'POST', {});
}

export async function fetchProjectMilestones(token: string, projectId: number): Promise<BdsMilestone[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/milestones`);
}

export function postProjectMilestone(
  token: string,
  projectId: number,
  body: { code: string; name: string; target_date?: string },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/milestones`, 'POST', body);
}

export function postMilestoneReach(
  token: string,
  milestoneId: string,
  body: { actual_date?: string },
) {
  return bdsMutate(token, `/api/v1/bds/milestones/${milestoneId}/reach`, 'POST', body);
}

export async function fetchPlanRevisions(token: string, projectId: number): Promise<BdsPlanRevision[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/plan-revisions`);
}

export function postPlanRevision(
  token: string,
  projectId: number,
  body: { kind?: string; body_json?: unknown },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/plan-revisions`, 'POST', body);
}

export function postPlanApprove(token: string, revisionId: string, reviewed_by: string) {
  return bdsMutate(token, `/api/v1/bds/plan-revisions/${revisionId}/approve`, 'POST', { reviewed_by });
}

// --- W2: Policies ---

export async function fetchProjectPolicies(token: string, projectId: number): Promise<BdsPolicy[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/policies`);
}

export function postProjectPolicy(
  token: string,
  projectId: number,
  body: {
    code: string;
    name: string;
    hdmb_min_paid_pct?: number;
    discount_cap_pct?: number;
  },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/policies`, 'POST', body);
}

export function postPolicyUpdate(
  token: string,
  policyId: string,
  body: { code?: string; name?: string; hdmb_min_paid_pct?: number },
) {
  return bdsMutate(token, `/api/v1/bds/policies/${policyId}/update`, 'POST', body);
}

export function postPolicyActivate(
  token: string,
  policyId: string,
  body: { phase_id: string; price_list_id: number; actor_role: string; activated_by?: string },
) {
  return bdsMutate(token, `/api/v1/bds/policies/${policyId}/activate`, 'POST', body);
}

export function postPolicyArchive(token: string, policyId: string, body: { actor_role: string }) {
  return bdsMutate(token, `/api/v1/bds/policies/${policyId}/archive`, 'POST', body);
}

export function postPolicyQuote(
  token: string,
  policyId: string,
  body: { list_price_vnd: number; discount_pct: number; net_price_vnd?: number; discount_approved?: boolean },
) {
  return bdsMutate(token, `/api/v1/bds/policies/${policyId}/quote`, 'POST', body);
}

export async function fetchPriceLists(token: string, projectId: number): Promise<BdsPriceList[]> {
  if (!isPositiveProjectId(projectId)) return [];
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/price-lists`);
}

export function postPriceList(
  token: string,
  projectId: number,
  body: { version_code: string; name?: string },
) {
  return bdsMutate(token, `/api/v1/bds/projects/${projectId}/price-lists`, 'POST', body);
}

export function postPriceListItem(
  token: string,
  priceListId: number,
  body: { unit_code: string; list_price_vnd?: number },
) {
  return bdsMutate(token, `/api/v1/bds/price-lists/${priceListId}/items`, 'POST', body);
}

// --- W2: Agencies ---

export function fetchAgency(token: string, agencyId: string) {
  return bdsFetch<BdsAgency>(token, `/api/v1/bds/agencies/${agencyId}`);
}

export function postAgency(
  token: string,
  body: { code: string; name?: string; kind?: string; parent_agency_id?: string },
) {
  return bdsMutate<BdsAgency>(token, '/api/v1/bds/agencies', 'POST', body);
}

export function postAgencyActivate(token: string, agencyId: string, body: { actor_role: string }) {
  return bdsMutate(token, `/api/v1/bds/agencies/${agencyId}/activate`, 'POST', body);
}

export function postAgencySuspend(token: string, agencyId: string) {
  return bdsMutate(token, `/api/v1/bds/agencies/${agencyId}/suspend`, 'POST', {});
}

export function postAgencyContract(
  token: string,
  agencyId: string,
  body: { project_id: number; max_concurrent_holds?: number },
) {
  return bdsMutate(token, `/api/v1/bds/agencies/${agencyId}/contracts`, 'POST', body);
}

export function postAgencyGrantUnits(
  token: string,
  agencyId: string,
  body: {
    project_id: number;
    product_ids: number[];
    exclusivity?: 'exclusive' | 'shared';
    actor_role?: string;
    granted_by?: string;
  },
) {
  return bdsMutate(token, `/api/v1/bds/agencies/${agencyId}/basket/units`, 'POST', body);
}

export function postAgencyRevokeUnit(
  token: string,
  agencyId: string,
  productId: number,
  reason?: string,
) {
  return bdsMutate(
    token,
    `/api/v1/bds/agencies/${agencyId}/basket/units/${productId}/revoke`,
    'POST',
    { reason: reason ?? '' },
  );
}

export async function fetchAgencyBasket(
  token: string,
  agencyId: string,
  projectId?: number,
): Promise<BdsBasketUnit[]> {
  const extraHeaders =
    projectId != null && isPositiveProjectId(projectId)
      ? { 'x-bds-project': String(projectId) }
      : undefined;
  return bdsFetch<BdsBasketUnit[]>(
    token,
    `/api/v1/bds/agencies/${agencyId}/basket`,
    extraHeaders,
  );
}

export function postAgencyTierOverride(
  token: string,
  agencyId: string,
  body: { tier_code: string; actor_role: string; reason: string; until?: string },
) {
  return bdsMutate(token, `/api/v1/bds/agencies/${agencyId}/tier/override`, 'POST', body);
}

export function postTiersRecalc(
  token: string,
  body: {
    period_month: string;
    targets?: Array<{ agencyId: string; target_gmv: number; target_units: number }>;
  },
) {
  return bdsMutate(token, '/api/v1/bds/tiers/recalc', 'POST', body);
}

// --- W2: Inventory ---

export async function fetchProjectUnits(token: string, projectId: number): Promise<BdsUnit[]> {
  if (!isPositiveProjectId(projectId)) return [];
  const result = await bdsFetch<{ units: BdsUnit[] }>(
    token,
    `/api/v1/bds/projects/${projectId}/units`,
  );
  return result.units ?? [];
}

export async function fetchProjectStack(token: string, projectId: number): Promise<BdsStack | null> {
  if (!isPositiveProjectId(projectId)) return null;
  return bdsFetch(token, `/api/v1/bds/projects/${projectId}/stack`);
}

export function postUnitImport(token: string, projectId: number, csv: string) {
  return bdsMutate<BdsImportResult>(
    token,
    `/api/v1/bds/projects/${projectId}/units/import`,
    'POST',
    { csv },
  );
}

export function postUnitLock(
  token: string,
  unitId: number,
  body: { row_version: number; reason?: string },
) {
  return bdsMutate(token, `/api/v1/bds/units/${unitId}/lock`, 'POST', body);
}

export function postUnitUnlock(token: string, unitId: number, body: { row_version: number }) {
  return bdsMutate(token, `/api/v1/bds/units/${unitId}/unlock`, 'POST', body);
}

export function patchUnitPool(
  token: string,
  unitId: number,
  body: { row_version: number; pool: string },
) {
  return bdsMutate(token, `/api/v1/bds/units/${unitId}/pool`, 'PATCH', body);
}

// --- W3: Commission ---

export function postCommissionScheme(
  token: string,
  body: { project_id: number; phase_id?: string; base?: BdsSchemeBase },
) {
  return bdsMutate<BdsCommissionScheme>(token, '/api/v1/bds/commission-schemes', 'POST', body);
}

export function postCommissionSchemeTiers(
  token: string,
  schemeId: string,
  tiers: BdsSchemeTierInput[],
) {
  return bdsMutate(token, `/api/v1/bds/commission-schemes/${schemeId}/tiers`, 'POST', { tiers });
}

export function postCommissionSchemeSplits(
  token: string,
  schemeId: string,
  splits: BdsSchemeSplitInput[],
) {
  return bdsMutate(token, `/api/v1/bds/commission-schemes/${schemeId}/splits`, 'POST', { splits });
}

export function postCommissionSchemeActivate(token: string, schemeId: string) {
  return bdsMutate<BdsCommissionScheme>(
    token,
    `/api/v1/bds/commission-schemes/${schemeId}/activate`,
    'POST',
  );
}

export function postCommissionStatementLock(
  token: string,
  body: { agency_id: string; period_month: string },
) {
  return bdsMutate<BdsCommissionStatement>(
    token,
    '/api/v1/bds/commission-statements/lock',
    'POST',
    body,
  );
}

export function postCommissionStatementApprove(token: string, statementId: string) {
  return bdsMutate<BdsCommissionStatement>(
    token,
    `/api/v1/bds/commission-statements/${statementId}/approve`,
    'POST',
  );
}

export function postCommissionStatementPay(token: string, statementId: string) {
  return bdsMutate<BdsCommissionStatement>(
    token,
    `/api/v1/bds/commission-statements/${statementId}/pay`,
    'POST',
  );
}

export function postCommissionAdvance(
  token: string,
  body: { agency_id: string; amount_vnd: number; period_month: string; note?: string },
) {
  return bdsMutate(token, '/api/v1/bds/commission-advances', 'POST', body);
}
