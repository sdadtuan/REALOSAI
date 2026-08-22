export type SandboxBoardKpis = {
  industry: string;
  tenant: string;
  leads_this_week: number;
  cpl_demo_usd: number;
  demos_booked: number;
  sample_data: true;
};

const BOARD_BY_INDUSTRY: Record<string, Omit<SandboxBoardKpis, 'tenant' | 'sample_data'>> = {
  agency: { industry: 'agency', leads_this_week: 18, cpl_demo_usd: 42, demos_booked: 6 },
  bds: { industry: 'bds', leads_this_week: 12, cpl_demo_usd: 55, demos_booked: 4 },
  fnb: { industry: 'fnb', leads_this_week: 22, cpl_demo_usd: 28, demos_booked: 9 },
  education: { industry: 'education', leads_this_week: 15, cpl_demo_usd: 36, demos_booked: 5 },
  pharma: { industry: 'pharma', leads_this_week: 9, cpl_demo_usd: 68, demos_booked: 3 },
  other: { industry: 'other', leads_this_week: 11, cpl_demo_usd: 44, demos_booked: 4 },
};

export function getSandboxBoardKpis(tenant: string, industryOverride?: string): SandboxBoardKpis {
  const industry =
    industryOverride ??
    (/^sandbox_(.+)$/.exec(tenant.trim())?.[1] ?? 'other');
  const base = BOARD_BY_INDUSTRY[industry] ?? BOARD_BY_INDUSTRY.other;
  return {
    ...base,
    tenant,
    sample_data: true,
  };
}
