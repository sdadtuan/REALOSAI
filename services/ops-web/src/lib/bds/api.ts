import { API_BASE } from '@/lib/api';
import type { HubResponse, LeaderboardRow } from './types';

export type { HubResponse, LeaderboardRow };

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
