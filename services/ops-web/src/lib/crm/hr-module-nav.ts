import { hasCap, type StoredStaffUser } from '@/lib/auth';

export type ModuleNavLink = {
  href: string;
  label: string;
};

export function buildCrmHrModuleLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  const links: ModuleNavLink[] = [];

  const canHub =
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_kpi_records', 'view') ||
    hasCap(user, 'crm_staff_kpi_am_sp', 'view') ||
    hasCap(user, 'crm_data_config', 'view');

  if (canHub) {
    links.push({ href: '/crm/hr', label: 'HR Hub' });
  }

  if (hasCap(user, 'crm_staff_roster', 'view')) {
    links.push({ href: '/crm/staff', label: 'Nhân viên' });
  }
  if (
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    links.push({ href: '/crm/payroll', label: 'Chấm công & lương' });
  }
  if (hasCap(user, 'crm_staff_kpi_am_sp', 'view')) {
    links.push({ href: '/crm/staff-kpi', label: 'KPI AM/SP' });
  }
  if (hasCap(user, 'crm_kpi_records', 'view')) {
    links.push({ href: '/crm/kpi', label: 'KPI tổ chức' });
  }
  if (hasCap(user, 'crm_data_config', 'view')) {
    links.push({ href: '/admin/crm/permissions', label: 'Ma trận quyền' });
  }

  return links;
}
