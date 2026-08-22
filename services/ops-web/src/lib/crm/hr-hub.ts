import { hasCap, type StoredStaffUser } from '@/lib/auth';
import { winOrgUiEnabled } from '@/lib/win/flags';

export type HrHubGroupId = 'workforce' | 'identity' | 'timepay' | 'performance' | 'talent';

export type HrHubCard = {
  id: string;
  group: HrHubGroupId;
  label: string;
  description: string;
  href?: string;
  /** Planned route — show on hub without link until shipped */
  planned?: boolean;
  badge?: string;
};

export type HrHubGroup = {
  id: HrHubGroupId;
  title: string;
  subtitle: string;
  cards: HrHubCard[];
};

const GROUP_META: Record<HrHubGroupId, { title: string; subtitle: string }> = {
  workforce: {
    title: 'Hồ sơ & tổ chức',
    subtitle: 'Roster nhân viên, workspace, org (R2-HR)',
  },
  identity: {
    title: 'Tài khoản & quyền',
    subtitle: 'Login, chức vụ, job function, ma trận RBAC',
  },
  timepay: {
    title: 'Chấm công & lương',
    subtitle: 'Attendance lite — export kế toán, không thay MISA',
  },
  performance: {
    title: 'Hiệu suất & KPI',
    subtitle: 'KPI gắn CRM, lifecycle AM/SP, thưởng tháng',
  },
  talent: {
    title: 'Cấu hình talent',
    subtitle: 'Cấp bậc S/A/B/C, competency, routing lead',
  },
};

function canViewHrHub(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_kpi_records', 'view') ||
    hasCap(user, 'crm_staff_kpi_am_sp', 'view') ||
    hasCap(user, 'crm_data_config', 'view')
  );
}

export function buildHrHubGroups(user: StoredStaffUser | null): HrHubGroup[] {
  if (!canViewHrHub(user)) return [];

  const cards: HrHubCard[] = [];

  if (hasCap(user, 'crm_staff_roster', 'view')) {
    cards.push({
      id: 'staff-roster',
      group: 'workforce',
      label: 'Danh sách nhân viên',
      description: 'Roster, import, tìm kiếm hồ sơ',
      href: '/crm/staff',
    });
  }

  cards.push({
    id: 'payslip-me',
    group: 'timepay',
    label: 'Phiếu lương của tôi',
    description: 'Xem & tải Excel read-only (WIN-4-D)',
    href: '/crm/payroll/me',
    badge: 'Self',
  });

  cards.push({
    id: 'my-wallet',
    group: 'timepay',
    label: 'Ví giấy tờ của tôi',
    description: 'Nộp bằng cấp / chứng chỉ chờ HR duyệt',
    href: '/crm/hr/my-wallet',
    badge: 'Self',
  });

  cards.push({
    id: 'gps-punch-me',
    group: 'timepay',
    label: 'Chấm công GPS',
    description: 'Vào/Ra ca qua geofence — trên Phiếu lương của tôi',
    href: '/crm/payroll/me',
    badge: 'P8',
  });

  if (
    hasCap(user, 'crm_hr_leave', 'request') ||
    hasCap(user, 'crm_hr_leave', 'approve') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    cards.push({
      id: 'leave-lite',
      group: 'timepay',
      label: 'Nghỉ phép lite',
      description: 'Gửi đơn & theo dõi duyệt stub',
      href: '/crm/hr/leave',
      badge: 'WIN-4-D',
    });
  }

  if (hasCap(user, 'crm_data_config', 'view')) {
    cards.push({
      id: 'permissions-position',
      group: 'identity',
      label: 'Ma trận chức vụ',
      description: 'Base caps theo KD-01, MKT-02…',
      href: '/admin/crm/permissions',
    });
    cards.push({
      id: 'permissions-functions',
      group: 'identity',
      label: 'Ma trận job function',
      description: 'Add-on content, design, leader…',
      href: '/admin/crm/permissions/functions',
    });
    cards.push({
      id: 'org-users',
      group: 'identity',
      label: 'Người dùng & quyền',
      description: 'Onboard login + position + functions',
      ...(winOrgUiEnabled()
        ? { href: '/admin/crm/org/users' }
        : { planned: true, badge: 'WIN-2' }),
    });
  }

  if (
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    cards.push({
      id: 'payroll',
      group: 'timepay',
      label: 'Chấm công & lương',
      description: 'Policy ca, attendance, tính lương tháng',
      href: '/crm/payroll',
    });
  }

  if (
    hasCap(user, 'crm_hr_attendance', 'device') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'edit')
  ) {
    cards.push({
      id: 'attendance-device',
      group: 'timepay',
      label: 'Chấm công máy',
      description: 'Import CSV, thiết bị ADMS, site GPS, PIN chưa map',
      href: '/crm/hr/attendance',
      badge: 'P7+P8',
    });
  }

  if (hasCap(user, 'crm_kpi_records', 'view')) {
    cards.push({
      id: 'kpi-org',
      group: 'performance',
      label: 'KPI tổ chức',
      description: 'Tiles, chart, export Excel thưởng',
      href: '/crm/kpi',
    });
  }

  if (hasCap(user, 'crm_staff_kpi_am_sp', 'view')) {
    cards.push({
      id: 'kpi-am-sp',
      group: 'performance',
      label: 'KPI AM / SP',
      description: 'Lifecycle revenue, tasks, margin',
      href: '/crm/staff-kpi',
    });
  }

  if (hasCap(user, 'crm_staff_roster', 'edit')) {
    cards.push({
      id: 'staff-levels',
      group: 'talent',
      label: 'Cấp bậc S/A/B/C',
      description: 'Routing lead, seniority config',
      href: '/crm/staff?tab=levels',
    });
    cards.push({
      id: 'staff-competency',
      group: 'talent',
      label: 'Competency matrix',
      description: 'Kỹ năng theo dịch vụ / ngành',
      href: '/crm/staff?tab=competency',
    });
  }

  const groupOrder: HrHubGroupId[] = ['workforce', 'identity', 'timepay', 'performance', 'talent'];
  return groupOrder
    .map((id) => {
      const groupCards = cards.filter((c) => c.group === id);
      if (!groupCards.length) return null;
      return {
        id,
        title: GROUP_META[id].title,
        subtitle: GROUP_META[id].subtitle,
        cards: groupCards,
      };
    })
    .filter((g): g is HrHubGroup => g != null);
}

export { canViewHrHub };
