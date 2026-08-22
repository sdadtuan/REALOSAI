export type KpiTeamCode = 'all' | 'sales' | 'solution' | 'cskh';

export function normalizeKpiTeam(raw?: string | null): KpiTeamCode {
  const s = String(raw ?? 'all').trim().toLowerCase();
  if (s === 'sales' || s === 'solution' || s === 'cskh') return s;
  return 'all';
}

export const KPI_TEAM_DEPT_PATTERNS: Record<Exclude<KpiTeamCode, 'all'>, string[]> = {
  sales: ['%sales%', '%kinh doanh%', '%kd%', '%am%'],
  solution: ['%solution%', '%sol%', '%mkt%'],
  cskh: ['%cskh%', '%chăm sóc%', '%cs%', '%customer%'],
};
