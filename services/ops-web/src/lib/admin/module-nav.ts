import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { buildCrmConfigModuleLinksFromAdminNav } from './admin-nav';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildFinanceDashboardLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  const links: ModuleNavLink[] = [];

  if (hasCap(user, 'crm_business_dashboard', 'view')) {
    links.push({ href: '/crm/business-dashboard', label: 'Dashboard KD' });
    links.push({ href: '/crm/forecast', label: 'Forecast' });
    links.push({ href: '/crm/financials', label: 'Tài chính' });
    links.push({ href: '/crm/ai/query', label: 'NL Analytics' });
  } else if (hasCap(user, 'ai_analytics', 'query')) {
    links.push({ href: '/crm/ai/query', label: 'NL Analytics' });
  }

  if (hasCap(user, 'crm_kpi_records', 'view')) {
    links.push({ href: '/crm/gdkd-enterprise', label: 'KPI GDKD' });
    links.push({ href: '/crm/kpi', label: 'KPI' });
    links.push({ href: '/crm/ai/insights', label: 'AI Insights' });
    links.push({ href: '/crm/ai/coach', label: 'Coach' });
  } else if (hasCap(user, 'crm_business_dashboard', 'view')) {
    links.push({ href: '/crm/gdkd-enterprise', label: 'KPI GDKD' });
    links.push({ href: '/crm/ai/coach', label: 'Coach' });
  }

  if (hasCap(user, 'crm_staff_kpi_am_sp', 'view')) {
    links.push({ href: '/crm/staff-kpi', label: 'KPI AM/SP' });
  }

  if (hasCap(user, 'crm_owner_weekly_dashboard', 'view')) {
    links.push({ href: '/crm/owner-weekly', label: 'BC tuần' });
  }

  if (
    hasCap(user, 'crm_agency', 'view') ||
    hasCap(user, 'crm_board', 'view') ||
    hasCap(user, 'ai_admin', 'view')
  ) {
    links.push({ href: '/crm/health', label: 'CS Health' });
  }

  return links;
}

export function buildAiAutomationModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  const links: ModuleNavLink[] = [];

  if (hasCap(user, 'automation_workflows', 'view')) {
    links.push({ href: '/crm/automation', label: 'Workflows' });
  }
  if (hasCap(user, 'playbooks', 'view')) {
    links.push({ href: '/crm/playbooks', label: 'Playbooks' });
  }

  return links;
}

export function buildCrmConfigModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  return buildCrmConfigModuleLinksFromAdminNav(user);
}
