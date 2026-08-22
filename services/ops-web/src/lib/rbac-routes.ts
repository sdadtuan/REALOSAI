import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export type StaffRouteZone = 'crm' | 'seo' | 'email';

export interface CapRequirement {
  section: string;
  action: string;
}

/** Longest-prefix match wins (more specific rules first). */
const PATH_CAP_RULES: Array<{ prefix: string; anyOf: CapRequirement[] }> = [
  {
    prefix: '/crm/solution',
    anyOf: [
      { section: 'crm_presales_solution', action: 'view' },
      { section: 'crm_leads', action: 'view' },
    ],
  },
  {
    prefix: '/crm/intake',
    anyOf: [{ section: 'crm_leads', action: 'view' }],
  },
  {
    prefix: '/crm/b2b-projects',
    anyOf: [{ section: 'crm_b2b_projects', action: 'view' }],
  },
  {
    prefix: '/crm/b2b',
    anyOf: [{ section: 'crm_leads', action: 'view' }],
  },
  {
    prefix: '/crm/leads',
    anyOf: [{ section: 'crm_leads', action: 'view' }],
  },
  {
    prefix: '/crm/cskh-board',
    anyOf: [
      { section: 'crm_board', action: 'view' },
      { section: 'crm_board_kanban', action: 'view' },
      { section: 'crm_board_funnel', action: 'view' },
    ],
  },
  {
    prefix: '/crm/spa',
    anyOf: [
      { section: 'crm_board', action: 'view' },
      { section: 'crm_board_kanban', action: 'view' },
    ],
  },
  {
    prefix: '/seo',
    anyOf: [
      { section: 'crm_seo_aeo', action: 'view' },
      { section: 'crm_seo_aeo_write', action: 'view' },
      { section: 'crm_seo_aeo_reports', action: 'view' },
      { section: 'crm_agency', action: 'view' },
    ],
  },
  {
    prefix: '/email',
    anyOf: [
      { section: 'crm_email_mkt', action: 'view' },
      { section: 'crm_agency', action: 'view' },
    ],
  },
  {
    prefix: '/crm/video',
    anyOf: [
      { section: 'crm_vd.project', action: 'view' },
      { section: 'crm_content', action: 'view' },
    ],
  },
  {
    prefix: '/crm',
    anyOf: [
      { section: 'crm_leads', action: 'view' },
      { section: 'crm_board', action: 'view' },
      { section: 'crm_board_funnel', action: 'view' },
      { section: 'crm_board_kanban', action: 'view' },
      { section: 'crm_board_workspace', action: 'view' },
      { section: 'crm_board_customers', action: 'view' },
      { section: 'crm_agency', action: 'view' },
      { section: 'crm_hub_campaigns', action: 'view' },
      { section: 'crm_sales_overview', action: 'view' },
      { section: 'crm_business_dashboard', action: 'view' },
      { section: 'crm_kpi_records', action: 'view' },
      { section: 'crm_staff_roster', action: 'view' },
      { section: 'crm_sop_runs', action: 'view' },
      { section: 'crm_re_projects', action: 'view' },
      { section: 'crm_b2b_projects', action: 'view' },
      { section: 'crm_mktplan', action: 'view' },
      { section: 'crm_presales_solution', action: 'view' },
      { section: 'ai_analytics', action: 'query' },
      { section: 'ai_admin', action: 'view' },
    ],
  },
];

const ZONE_DEFAULTS: Record<StaffRouteZone, CapRequirement[]> = {
  crm: PATH_CAP_RULES.find((r) => r.prefix === '/crm')!.anyOf,
  seo: PATH_CAP_RULES.find((r) => r.prefix === '/seo')!.anyOf,
  email: PATH_CAP_RULES.find((r) => r.prefix === '/email')!.anyOf,
};

export function hasAnyCap(user: StoredStaffUser | null, requirements: CapRequirement[]): boolean {
  return requirements.some((req) => hasCap(user, req.section, req.action));
}

export function resolvePathCapRequirements(pathname: string, zone?: StaffRouteZone): CapRequirement[] {
  const path = pathname.split('?')[0] ?? pathname;
  const sorted = [...PATH_CAP_RULES].sort((a, b) => b.prefix.length - a.prefix.length);
  for (const rule of sorted) {
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.anyOf;
    }
  }
  if (zone) return ZONE_DEFAULTS[zone];
  return [];
}

export function canAccessPath(
  pathname: string,
  user: StoredStaffUser | null,
  zone?: StaffRouteZone,
): boolean {
  const requirements = resolvePathCapRequirements(pathname, zone);
  if (!requirements.length) return true;
  return hasAnyCap(user, requirements);
}

/** Path prefixes that require staff login (middleware). */
export const STAFF_AUTH_PREFIXES = [
  '/crm',
  '/seo',
  '/email',
  '/agency',
  '/meta',
  '/google',
  '/zalo',
  '/admin',
] as const;

export function isStaffAuthPath(pathname: string): boolean {
  if (pathname === '/') return true;
  return STAFF_AUTH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
