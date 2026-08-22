export type SandboxLeadRow = {
  id: string;
  full_name: string;
  company: string;
  status: string;
  created_at: string;
};

const NAMES = [
  ['Alex Nguyen', 'Sample Co'],
  ['Jamie Park', 'Demo Ltd'],
  ['Taylor Vo', 'Northstar Media'],
  ['Jordan Lee', 'Bright F&B'],
  ['Casey Tran', 'Edu Partners'],
];

export function tenantIndustry(tenant: string): string {
  const match = /^sandbox_(.+)$/.exec(tenant.trim());
  return match?.[1] ?? 'other';
}

export function seedSandboxLeads(tenant: string): SandboxLeadRow[] {
  const industry = tenantIndustry(tenant);
  const statuses = ['new', 'qualified', 'demo_booked', 'qualified', 'new'];
  return NAMES.map(([full_name, company], index) => ({
    id: `${industry}-${index + 1}`,
    full_name,
    company: `${company} (${industry})`,
    status: statuses[index] ?? 'new',
    created_at: `2026-08-${String(10 + index).padStart(2, '0')}`,
  }));
}
