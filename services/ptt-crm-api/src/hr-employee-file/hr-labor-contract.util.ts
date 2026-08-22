import type { HrLaborContractRow, HrLaborContractStatus } from './hr-labor-contract.types';

const MS_DAY = 86_400_000;

export function computeContractDisplayStatus(
  row: Pick<HrLaborContractRow, 'status' | 'expires_on' | 'kind'>,
): HrLaborContractStatus | 'expiring' {
  if (row.status !== 'active') return row.status;
  if (row.kind === 'indefinite' || !row.expires_on) return 'active';
  const exp = new Date(`${String(row.expires_on).slice(0, 10)}T00:00:00Z`).getTime();
  const now = Date.now();
  if (exp < now) return 'expired';
  if (exp - now <= 30 * MS_DAY) return 'expiring' as HrLaborContractStatus;
  return 'active';
}

export function isContractExpiringSoon(expiresOn: string | null | undefined, kind: string): boolean {
  if (kind === 'indefinite' || !expiresOn) return false;
  const exp = new Date(`${String(expiresOn).slice(0, 10)}T00:00:00Z`).getTime();
  return exp - Date.now() <= 30 * MS_DAY && exp >= Date.now();
}

export function maskSalary(amount: number | null | undefined, canViewPii: boolean): number | null {
  if (amount == null) return null;
  return canViewPii ? amount : null;
}

export function bodyContainsSalary(body: Record<string, unknown>): boolean {
  return body.salary_gross !== undefined;
}
