import { API_BASE } from '@/lib/api';
import type {
  BdsAgingRow,
  BdsBuyerRow,
  BdsHdmbGate,
  BdsHoldRow,
  BdsHoldStatus,
  BdsTxRow,
  HubResponse,
  LeaderboardRow,
} from './types';

export type {
  BdsAgingRow,
  BdsBuyerRow,
  BdsHdmbGate,
  BdsHoldRow,
  BdsHoldStatus,
  BdsTxRow,
  HubResponse,
  LeaderboardRow,
};

const TENANT_STORAGE_KEY = 'bds-tenant-id';
const MODE_STORAGE_KEY = 'bds-tenant-mode';

export function getBdsTenantId(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(TENANT_STORAGE_KEY)?.trim();
    if (stored) return stored;
  }
  return (process.env.NEXT_PUBLIC_BDS_TENANT_ID ?? '').trim();
}

export function setBdsTenantMode(mode: string): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(MODE_STORAGE_KEY, mode);
}

export function getBdsTenantMode(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(MODE_STORAGE_KEY);
}

async function bdsFetch<T>(token: string, path: string): Promise<T> {
  const tenantId = getBdsTenantId();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'x-bds-tenant': tenantId } : {}),
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
  return bdsFetch<BdsTenantMe>(token, '/api/v1/bds/tenants/me');
}

export async function fetchBdsHub(token: string): Promise<HubResponse> {
  return bdsFetch<HubResponse>(token, '/api/v1/bds/hub');
}

export async function fetchBdsLeaderboard(token: string, period?: string): Promise<LeaderboardRow[]> {
  const qs = period ? `?period=${encodeURIComponent(period)}` : '';
  return bdsFetch<LeaderboardRow[]>(token, `/api/v1/bds/leaderboard${qs}`);
}

export async function fetchBdsAgencies(token: string): Promise<Array<{ id: string; name: string; code: string }>> {
  return bdsFetch(token, '/api/v1/bds/agencies');
}

export async function fetchBdsMeBasket(token: string): Promise<{ items: unknown[] }> {
  return bdsFetch(token, '/api/v1/bds/me/basket');
}

export async function fetchBdsCommissions(
  token: string,
  agencyId: string,
  period: string,
): Promise<Array<{ id: string; amount_vnd: number; pct?: number; trigger_stage?: string }>> {
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
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`${res.status} ${err.error ?? path}`);
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
    ttl_remaining_sec: number | null;
    status: string;
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
