import { hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  winFieldAbacEnabled,
  winOrgUiEnabled,
  winPermissionSetsEnabled,
  winSimulatorEnabled,
  winSsoEnabled,
} from '@/lib/win/flags';
import type { ModuleNavLink } from './module-nav';

export type AdminNavGroupId =
  | 'org'
  | 'rbac'
  | 'data'
  | 'services'
  | 'ai'
  | 'compliance'
  | 'integrations'
  | 'policy';

export type AdminNavLink = ModuleNavLink;

export type AdminNavGroup = {
  id: AdminNavGroupId;
  label: string;
  description: string;
  links: AdminNavLink[];
};

export type AdminHubWorkspace = {
  id: AdminNavGroupId;
  title: string;
  description: string;
  href: string;
  stat?: string;
};

export function canViewAdminSection(user: StoredStaffUser | null): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'crm_data_config', 'view') ||
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'ai_admin', 'view') ||
    hasCap(user, 'crm_vd.admin', 'view') ||
    hasCap(user, 'crm_vd.admin', 'create') ||
    hasCap(user, 'spc', 'view')
  );
}

function canViewVdProviders(user: StoredStaffUser): boolean {
  return (
    hasCap(user, 'crm_vd.admin', 'view') ||
    hasCap(user, 'crm_vd.admin', 'create') ||
    hasCap(user, 'ai_admin', 'view')
  );
}

function canViewOrgAdmin(user: StoredStaffUser): boolean {
  if (!winOrgUiEnabled()) return false;
  return (
    hasCap(user, 'crm_staff_departments', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_data_config', 'view')
  );
}

function buildRbacLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!hasCap(user, 'crm_data_config', 'view')) return [];
  const links: AdminNavLink[] = [
    { href: '/admin/crm/permissions', label: 'Ma trận chức vụ' },
    { href: '/admin/crm/permissions/functions', label: 'Job function' },
    { href: '/admin/crm/permissions/users', label: 'Gán user' },
  ];
  if (winPermissionSetsEnabled()) {
    links.push({ href: '/admin/crm/permission-sets', label: 'Permission Sets' });
  }
  if (winSimulatorEnabled()) {
    links.push({ href: '/admin/crm/permissions/simulator', label: 'Simulator' });
  }
  if (winFieldAbacEnabled()) {
    links.push({ href: '/admin/crm/permissions/fields', label: 'Field ABAC' });
  }
  if (winSsoEnabled()) {
    links.push({ href: '/admin/crm/sso/groups', label: 'SSO groups' });
  }
  return links;
}

function buildDataLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!hasCap(user, 'crm_data_config', 'view')) return [];
  return [
    { href: '/admin/crm/custom-fields', label: 'Custom fields' },
    { href: '/admin/crm/pipeline', label: 'Pipeline sales' },
    { href: '/admin/crm/lead-lookups', label: 'Nguồn & Kênh' },
  ];
}

function buildOrgLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!canViewOrgAdmin(user)) return [];
  return [
    { href: '/admin/crm/org/users', label: 'Người dùng' },
    { href: '/admin/crm/org/users/new', label: 'Onboard NV' },
    { href: '/admin/crm/org/departments', label: 'Phòng ban' },
    { href: '/admin/crm/org/teams', label: 'Team' },
    { href: '/admin/crm/org/positions', label: 'Chức vụ (HR)' },
    { href: '/admin/crm/org/chart', label: 'Sơ đồ tổ chức' },
    { href: '/crm/staff?admin=1', label: 'Hồ sơ roster' },
  ];
}

function buildComplianceLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!hasCap(user, 'crm_data_config', 'view')) return [];
  return [
    { href: '/admin/audit', label: 'Audit Center' },
    { href: '/admin/audit/access-reviews', label: 'Access review campaigns' },
    { href: '/admin/audit/access-reviews/inbox', label: 'Inbox duyệt quyền' },
    { href: '/admin/audit/stale-accounts', label: 'Tài khoản không hoạt động' },
    { href: '/admin/audit/break-glass', label: 'Break-glass' },
    { href: '/admin/audit?category=permission_matrix', label: 'Lịch sử ma trận' },
  ];
}

function buildIntegrationsLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!hasCap(user, 'crm_data_config', 'view')) return [];
  const links: AdminNavLink[] = [{ href: '/admin/integrations', label: 'Registry tích hợp' }];
  if (winSsoEnabled()) {
    links.push({ href: '/admin/crm/sso/groups', label: 'SSO groups' });
  }
  return links;
}

function canViewPolicyAdmin(user: StoredStaffUser): boolean {
  return hasCap(user, 'admin_scope', 'policy') || hasCap(user, 'crm_data_config', 'view');
}

function buildPolicyLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!canViewPolicyAdmin(user)) return [];
  return [
    { href: '/admin/policies', label: 'OPA & Compliance packs' },
    { href: '/admin/environments', label: 'So sánh môi trường' },
    { href: '/admin/policies/approvals', label: 'Duyệt thay đổi' },
    { href: '/admin/crm/permissions/simulator', label: 'Simulator what-if' },
    { href: '/admin/ai/policies', label: 'AI governance' },
  ];
}

function buildServicesLinks(user: StoredStaffUser): AdminNavLink[] {
  if (!hasCap(user, 'spc', 'view') && !hasCap(user, 'crm_data_config', 'view')) return [];
  return [
    { href: '/admin/services', label: 'Hub catalog' },
    { href: '/admin/services/portfolio', label: 'Portfolio 21 DV' },
    { href: '/admin/services/process', label: 'Process phases' },
    { href: '/admin/services/publish', label: 'Publish & audit' },
    { href: '/crm/ops/catalog', label: 'Ops catalog (read)' },
  ];
}

function buildAiLinks(user: StoredStaffUser): AdminNavLink[] {
  const links: AdminNavLink[] = [];
  if (hasCap(user, 'ai_admin', 'view')) {
    links.push(
      { href: '/admin/ai/agents', label: 'AI Agents' },
      { href: '/admin/ai/tools', label: 'AI Tools' },
      { href: '/admin/ai/runs', label: 'AI Runs' },
    );
    if (canViewPolicyAdmin(user)) {
      links.push({ href: '/admin/ai/policies', label: 'AI governance' });
    }
  }
  if (canViewVdProviders(user)) {
    links.push({ href: '/admin/video/providers', label: 'Video SOP providers' });
  }
  return links;
}

export function buildAdminNavGroups(user: StoredStaffUser | null): AdminNavGroup[] {
  if (!user || !canViewAdminSection(user)) return [];

  const groups: AdminNavGroup[] = [];

  const orgLinks = buildOrgLinks(user);
  if (orgLinks.length) {
    groups.push({
      id: 'org',
      label: 'Nhân sự & Tổ chức',
      description: 'Onboard, org chart, hồ sơ NV',
      links: orgLinks,
    });
  }

  const rbacLinks = buildRbacLinks(user);
  if (rbacLinks.length) {
    groups.push({
      id: 'rbac',
      label: 'Phân quyền & Bảo mật',
      description: 'RBAC, SSO, simulator',
      links: rbacLinks,
    });
  }

  const dataLinks = buildDataLinks(user);
  if (dataLinks.length) {
    groups.push({
      id: 'data',
      label: 'Dữ liệu CRM',
      description: 'Schema, pipeline, lookups',
      links: dataLinks,
    });
  }

  const policyLinks = buildPolicyLinks(user);
  if (policyLinks.length) {
    groups.push({
      id: 'policy',
      label: 'Policy & Intelligence',
      description: 'OPA, env diff, what-if, duyệt thay đổi',
      links: policyLinks,
    });
  }

  const servicesLinks = buildServicesLinks(user);
  if (servicesLinks.length) {
    groups.push({
      id: 'services',
      label: 'Dịch vụ & Catalog',
      description: 'SPC portfolio, SKU, publish',
      links: servicesLinks,
    });
  }

  const aiLinks = buildAiLinks(user);
  if (aiLinks.length) {
    groups.push({
      id: 'ai',
      label: 'AI Platform',
      description: 'Agents, tools, runs',
      links: aiLinks,
    });
  }

  const complianceLinks = buildComplianceLinks(user);
  if (complianceLinks.length) {
    groups.push({
      id: 'compliance',
      label: 'Audit & Tuân thủ',
      description: 'Timeline, access review, break-glass',
      links: complianceLinks,
    });
  }

  const integrationsLinks = buildIntegrationsLinks(user);
  if (integrationsLinks.length) {
    groups.push({
      id: 'integrations',
      label: 'Tích hợp & Kết nối',
      description: 'Webhooks, OAuth tokens, SSO',
      links: integrationsLinks,
    });
  }

  return groups;
}

export function buildAdminHubWorkspaces(
  user: StoredStaffUser | null,
  stats?: Partial<Record<AdminNavGroupId, string>>,
): AdminHubWorkspace[] {
  return buildAdminNavGroups(user).map((group) => {
    let stat = stats?.[group.id] ?? `${group.links.length} mục`;
    if (!stats?.[group.id] && group.id === 'policy') {
      stat = 'OPA · env diff · duyệt';
    }
    if (!stats?.[group.id] && group.id === 'ai') {
      stat = 'Agents · governance';
    }
    return {
      id: group.id,
      title: group.label,
      description: group.description,
      href: group.links[0]?.href ?? '/admin',
      stat,
    };
  });
}

/** Sidebar site nav — one hub entry (HubSpot Settings pattern). */
export function buildAdminSidebarLinks(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!canViewAdminSection(user)) return [];
  return [{ href: '/admin', label: 'Trung tâm quản trị' }];
}

export function buildAdminSidebarLinksFlat(user: StoredStaffUser | null): ModuleNavLink[] {
  if (!user || !canViewAdminSection(user)) return [];
  return buildAdminNavGroups(user).flatMap((g) => g.links);
}

/** Subset for legacy ModuleSubNav on admin pages (deprecated — use AdminLeftRail). */
export function buildCrmConfigModuleLinksFromAdminNav(
  user: StoredStaffUser | null,
): ModuleNavLink[] {
  if (!user || !hasCap(user, 'crm_data_config', 'view')) return [];
  return [...buildDataLinks(user), ...buildRbacLinks(user)];
}
