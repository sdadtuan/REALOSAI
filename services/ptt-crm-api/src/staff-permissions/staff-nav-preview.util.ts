import type { StaffSectionCap } from '../staff-auth/staff-auth.types';

export type NavPreviewItem = {
  href: string;
  label: string;
  section: string;
  visible: boolean;
};

type NavRule = {
  href: string;
  label: string;
  section: string;
  action: string;
};

/** Simplified ops-web sidebar rules for simulator preview (WIN-3-B). */
const NAV_RULES: NavRule[] = [
  { href: '/', label: 'Bảng điều khiển', section: 'dashboard', action: 'view' },
  { href: '/crm', label: 'Bảng CSKH', section: 'crm_board', action: 'view' },
  { href: '/crm/operational/leads', label: 'Lead CSKH vận hành', section: 'crm_leads', action: 'view' },
  { href: '/crm/cskh-board', label: 'Bảng CSKH SLA', section: 'crm_leads', action: 'view' },
  { href: '/crm/leads/review-queue', label: 'Phải tra soát (B2)', section: 'crm_gdkd', action: 'review_queue' },
  { href: '/crm/b2b/leads', label: 'Lead B2B', section: 'crm_leads', action: 'view' },
  { href: '/crm/solution/queue', label: 'Solution queue', section: 'crm_presales_solution', action: 'view' },
  { href: '/crm/sales', label: 'Kinh doanh', section: 'crm_sales_overview', action: 'view' },
  { href: '/crm/leads', label: 'Tất cả leads', section: 'crm_leads', action: 'view' },
  { href: '/crm/customers', label: 'Khách hàng', section: 'crm_board_customers', action: 'view' },
  { href: '/crm/staff', label: 'Nhân viên', section: 'crm_staff_roster', action: 'view' },
  { href: '/crm/kpi', label: 'KPI', section: 'crm_kpi_records', action: 'view' },
  { href: '/crm/payroll', label: 'Chấm công & lương', section: 'crm_payroll_salary', action: 'view' },
  { href: '/crm/business-dashboard', label: 'Dashboard KD', section: 'crm_business_dashboard', action: 'view' },
  { href: '/crm/forecast', label: 'Forecast', section: 'crm_business_dashboard', action: 'view' },
  { href: '/crm/ai/query', label: 'NL Analytics', section: 'ai_analytics', action: 'query' },
  { href: '/admin/crm/permissions', label: 'Ma trận chức vụ', section: 'crm_data_config', action: 'view' },
  { href: '/admin/crm/permission-sets', label: 'Permission Sets', section: 'crm_data_config', action: 'configure' },
  { href: '/admin/crm/permissions/simulator', label: 'Simulator', section: 'crm_data_config', action: 'configure' },
  { href: '/meta/facebook-ads', label: 'Meta Ads', section: 'crm_facebook_ads', action: 'view' },
  { href: '/seo/hub', label: 'SEO Hub', section: 'crm_seo_aeo', action: 'view' },
  { href: '/email/hub', label: 'Email Hub', section: 'crm_email_mkt', action: 'view' },
];

function hasCap(caps: StaffSectionCap[], section: string, action: string): boolean {
  if (caps.some((c) => c.section === section && c.action === action)) return true;
  if (section === 'crm_gdkd' && (action === 'assign' || action === 'override')) {
    return caps.some((c) => c.section === 'crm_leads' && c.action === 'assign');
  }
  if (action === 'review_queue' && section === 'crm_gdkd') {
    return caps.some((c) => c.section === 'crm_gdkd' && c.action === 'review_queue');
  }
  return false;
}

export function buildNavPreview(caps: StaffSectionCap[]): NavPreviewItem[] {
  return NAV_RULES.map((rule) => {
    const visible =
      rule.href === '/'
        ? true
        : hasCap(caps, rule.section, rule.action) ||
          (rule.section === 'crm_presales_solution' && hasCap(caps, 'crm_leads', 'view'));
    return {
      href: rule.href,
      label: rule.label,
      section: rule.section,
      visible,
    };
  });
}

export function capsToStrings(caps: StaffSectionCap[]): string[] {
  return [...caps]
    .map((c) => `${c.section}.${c.action}`)
    .sort((a, b) => a.localeCompare(b, 'vi'));
}

export function diffCapStrings(base: string[], compare: string[]): { added: string[]; removed: string[] } {
  const baseSet = new Set(base);
  const compareSet = new Set(compare);
  return {
    added: compare.filter((c) => !baseSet.has(c)).sort(),
    removed: base.filter((c) => !compareSet.has(c)).sort(),
  };
}
