'use client';

import { buildAdminSidebarLinks, canViewAdminSection } from '@/lib/admin/admin-nav';
import { GlobalSearchBar } from '@/components/search/GlobalSearchBar';
import { WinRbacBadge } from '@/components/win';
import { iconForHref, NavIcon, sectionIcon, sectionShortLabel } from '@/components/layout/nav-icons';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { StoredStaffUser } from '@/lib/auth';
import { getAccessToken, hasCap } from '@/lib/auth';
import { fetchReviewQueueCount } from '@/lib/api';
import { isOpsDvFeEnabled } from '@/lib/ops-dv-flags';
import { emailGateAEnabled, emailJourneysEnabled, emailModuleEnabled } from '@/lib/email-flags';
import { winKpiSolutionEnabled, winLeaveLiteEnabled, winPayslipPortalEnabled } from '@/lib/win/flags';
import { StaffNotificationBell } from '@/components/staff/StaffNotificationBell';
import { canViewEmailGateA } from '@/lib/email/caps';
import { canViewMetaAdsOps, canViewMetaIntelligence, canViewMetaTracking } from '@/lib/meta/caps';
import {
  canViewSeoAeo,
  canViewSeoAuthority,
  canViewSeoAutomations,
  canViewSeoContent,
  canViewSeoBi,
  canViewSeoCms,
  canViewSeoGateA,
  canViewSeoExperiments,
  canViewSeoFreshness,
  canViewSeoGovernance,
  canViewSeoHub,
  canViewSeoRanks,
  canViewSeoReports,
  canViewSeoResearch,
  canViewSeoStrategy,
  canViewSeoTechnical,
} from '@/lib/seo/caps';
import {
  seoAeoEnabled,
  seoAuthorityEnabled,
  seoAutomationsEnabled,
  seoBiEnabled,
  seoCmsEnabled,
  seoGateAEnabled,
  seoContentEnabled,
  seoExperimentsEnabled,
  seoFreshnessEnabled,
  seoGovernanceEnabled,
  seoHubEnabled,
  seoRanksEnabled,
  seoReportsEnabled,
  seoResearchEnabled,
  seoStrategyEnabled,
  seoTechnicalEnabled,
} from '@/lib/seo/flags';
import { metaAdsOpsEnabled, metaIntelligenceEnabled, metaTrackingEnabled } from '@/lib/meta/flags';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';
import { shouldShowTaxonomyNav } from '@/components/research/taxonomy-pane.util';
import { canViewGtmCms, canViewGtmDemos } from '@/lib/gtm/caps';
import { shouldShowVideoSopNav } from '@/components/ops-nav-video-sop';

interface OpsNavProps {
  user: StoredStaffUser | null;
  onLogout: () => void;
  emailPendingApprovals?: number;
  agencyUnread?: number;
}

type NavLink = { href: string; label: string };
type NavSection = { label: string; links: NavLink[]; defaultOpen?: boolean };

const SIDEBAR_STORAGE_KEY = 'ops-sidebar-expanded';

function readSidebarExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

function applyShellClasses(expanded: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('ops-shell-expanded', expanded);
  document.documentElement.classList.toggle('ops-shell-collapsed', !expanded);
}

const PAGE_TITLES: Record<string, string> = {
  '/': 'Bảng điều khiển',
  '/crm': 'Bảng CSKH',
  '/crm/cskh-board': 'Bảng CSKH SLA',
  '/crm/tickets': 'Ticket CS',
  '/crm/leads': 'Quản lý Lead',
  '/crm/operational/leads': 'Lead CSKH vận hành',
  '/crm/b2b/leads': 'Lead B2B Sales',
  '/crm/leads/new': 'Tạo lead thủ công',
  '/crm/operational/leads/new': 'Tạo lead CSKH vận hành',
  '/crm/b2b/leads/new': 'Tạo lead B2B',
  '/crm/gdkd-enterprise': 'KPI GDKD Enterprise',
  '/crm/catalog': 'CRM Catalog',
  '/crm/customers': 'Khách hàng',
  '/crm/intake': 'Lead Intake',
  '/crm/research': 'Nghiên cứu thị trường',
  '/crm/research/new': 'Tạo dự án nghiên cứu',
  '/crm/research/analytics': 'Phân tích nghiên cứu',
  '/crm/research/taxonomy': 'Taxonomy',
  '/crm/gtm/demos': 'Demo PTTCRM',
  '/crm/gtm/cms': 'CMS marketing',
  '/crm/marketing-plan': 'Kế hoạch marketing',
  '/crm/service-delivery': 'Triển khai dịch vụ',
  '/crm/sop': 'Quy trình SOP',
  '/crm/launch-qa': 'Launch QA',
  '/crm/creatives': 'Creative Hub',
  '/crm/campaign-writes': 'Campaign Write',
  '/crm/sales': 'Kinh doanh',
  '/crm/kpi': 'KPI',
  '/crm/ai/insights': 'AI Insights',
  '/crm/ai/coach': 'Manager Coach',
  '/crm/ai/query': 'NL Analytics',
  '/crm/automation': 'Workflow automation',
  '/crm/playbooks': 'Playbook library',
  '/crm/hr': 'HR Hub',
  '/crm/staff-kpi': 'KPI AM/SP',
  '/crm/staff': 'Nhân viên',
  '/crm/proposals': 'Đề xuất dịch vụ',
  '/crm/orders': 'Đơn hàng',
  '/crm/invoices': 'Hóa đơn',
  '/crm/re-projects': 'Dự án BĐS',
  '/crm/b2b-projects': 'Dự án PTT',
  '/crm/b2b-inbox': 'Inbox B2B',
  '/crm/payroll': 'Chấm công & lương',
  '/crm/payroll/me': 'Phiếu lương của tôi',
  '/crm/hr/leave': 'Nghỉ phép lite',
  '/crm/business-dashboard': 'Dashboard kinh doanh',
  '/crm/forecast': 'Forecast doanh thu',
  '/crm/health': 'CS Health score',
  '/crm/owner-weekly': 'Báo cáo tuần chủ DN',
  '/crm/financials': 'Tài chính',
  '/admin': 'Quản trị hệ thống',
  '/admin/crm/custom-fields': 'Custom fields',
  '/admin/crm/pipeline': 'Pipeline sales',
  '/admin/crm/lead-lookups': 'Nguồn & Kênh',
  '/admin/crm/permissions': 'Ma trận chức vụ',
  '/admin/crm/permissions/functions': 'Job function',
  '/admin/crm/permissions/users': 'Gán user',
  '/admin/crm/permissions/simulator': 'Simulator',
  '/admin/crm/permissions/fields': 'Field ABAC',
  '/admin/crm/permission-sets': 'Permission Sets',
  '/admin/crm/sso/groups': 'SSO groups',
  '/admin/crm/org/users': 'Người dùng',
  '/admin/crm/org/users/new': 'Onboard NV',
  '/admin/crm/org/departments': 'Phòng ban',
  '/admin/crm/org/teams': 'Team',
  '/admin/crm/org/positions': 'Chức vụ',
  '/admin/crm/org/chart': 'Sơ đồ tổ chức',
  '/admin/ai/agents': 'AI Agents',
  '/admin/ai/runs': 'AI agent runs',
  '/admin/ai/tools': 'AI Tools',
  '/agency': 'Agency',
  '/agency/ingest': 'Pipeline ingest',
  '/agency/jobs': 'Pipeline ingest',
  '/agency/notifications': 'Thông báo Agency',
  '/agency/kpi-definitions': 'Định nghĩa KPI',
  '/meta/facebook-ads': 'Meta Ads',
  '/meta/ads-ops': 'Meta Ads Ops',
  '/meta/tracking': 'Meta Tracking',
  '/meta/intelligence': 'Meta Intelligence',
  '/google/google-ads': 'Google Ads',
  '/zalo/zalo-ads': 'Zalo Ads',
  '/zalo/leads': 'Zalo Leads',
  '/meta/ads-combined': 'Ads CPL',
  '/meta/migration': 'Meta Migration',
  '/crm/hub': 'Hub · Hợp đồng',
  '/seo/hub': 'SEO/AEO Hub',
  '/seo/clients': 'SEO Clients',
  '/seo/research': 'SEO Research',
  '/seo/content': 'SEO Content Pipeline',
  '/seo/technical': 'SEO Technical',
  '/seo/reports': 'SEO Reports',
  '/seo/governance': 'SEO Governance',
  '/seo/strategy': 'SEO Strategy',
  '/seo/aeo': 'AEO Console',
  '/seo/authority': 'Authority Console',
  '/seo/ranks': 'Rank Tracker',
  '/seo/automations': 'SEO Automations',
  '/seo/freshness': 'Freshness Queue',
  '/seo/experiments': 'SEO Experiments',
  '/seo/bi': 'SEO BI & Grafana',
  '/seo/cms': 'CMS Publish Pilot',
  '/seo/gate-a': 'SEO Gate A Go-live',
  '/email/hub': 'Email Hub',
  '/email/clients': 'Email Clients',
  '/email/contacts': 'Contacts',
  '/email/consent': 'Consent',
  '/email/suppression': 'Suppression',
  '/email/governance': 'Governance',
  '/email/segments': 'Segments',
  '/email/templates': 'Templates',
  '/email/campaigns': 'Campaigns',
  '/email/journeys': 'Journeys',
  '/email/deliverability': 'Deliverability',
  '/email/reports': 'Reports',
  '/email/gate-a': 'Email Gate A',
};

function pageTitleFor(pathname: string): string {
  if (pathname === '/crm/leads/new') return PAGE_TITLES['/crm/leads/new'];
  if (pathname === '/crm/operational/leads/new') return PAGE_TITLES['/crm/operational/leads/new'];
  if (pathname === '/crm/b2b/leads/new') return PAGE_TITLES['/crm/b2b/leads/new'];
  if (pathname.startsWith('/crm/operational/leads')) return PAGE_TITLES['/crm/operational/leads'];
  if (pathname.startsWith('/crm/b2b/leads')) return PAGE_TITLES['/crm/b2b/leads'];
  if (pathname.startsWith('/crm/leads/') && pathname !== '/crm/leads') return 'Chi tiết lead';
  if (pathname.startsWith('/crm/customers/') && pathname !== '/crm/customers') return 'Chi tiết khách hàng';
  if (
    pathname.startsWith('/crm/research/') &&
    pathname !== '/crm/research' &&
    pathname !== '/crm/research/new' &&
    pathname !== '/crm/research/analytics' &&
    pathname !== '/crm/research/taxonomy'
  ) {
    return 'Workspace nghiên cứu';
  }
  if (pathname.startsWith('/crm/marketing-plan/') && pathname !== '/crm/marketing-plan') {
    return 'Chi tiết kế hoạch';
  }
  if (pathname.startsWith('/crm/service-delivery/') && pathname !== '/crm/service-delivery') {
    return 'Service lifecycle';
  }
  if (pathname.startsWith('/crm/staff/') && pathname !== '/crm/staff') return 'Workspace nhân viên';
  if (pathname.startsWith('/crm/re-projects/') && pathname !== '/crm/re-projects') return 'Chi tiết dự án BĐS';
  if (pathname.startsWith('/crm/b2b-projects/') && pathname !== '/crm/b2b-projects') return 'Chi tiết dự án PTT';
  if (pathname.startsWith('/agency/clients/')) return 'Chi tiết client';
  if (pathname.startsWith('/email/templates/') && pathname !== '/email/templates') return 'Template editor';
  if (pathname.startsWith('/email/campaigns/') && pathname.endsWith('/review')) return 'Campaign review';
  if (pathname.startsWith('/email/campaigns/') && pathname !== '/email/campaigns') return 'Campaign detail';
  if (pathname.startsWith('/email/journeys/') && pathname !== '/email/journeys') return 'Journey canvas';
  if (pathname.startsWith('/email/clients/') && pathname !== '/email/clients') return 'Client workspace';
  if (pathname.startsWith('/seo/content/') && pathname !== '/seo/content') return 'Content detail';
  return PAGE_TITLES[pathname] ?? 'PTT CRM';
}

function navBadge(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

function isActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/') return false;
  if (href === '/crm/leads') {
    return pathname === '/crm/leads' || (pathname.startsWith('/crm/leads/') && !pathname.startsWith('/crm/leads/review-queue'));
  }
  return pathname.startsWith(`${href}/`);
}

function buildSeoLinks(user: StoredStaffUser | null): NavLink[] {
  if (!seoHubEnabled() || !canViewSeoHub(user)) return [];
  const links: NavLink[] = [
    { href: '/seo/hub', label: 'SEO/AEO Hub' },
    { href: '/seo/clients', label: 'SEO Clients' },
  ];
  if (seoResearchEnabled() && canViewSeoResearch(user)) links.push({ href: '/seo/research', label: 'SEO Research' });
  if (seoContentEnabled() && canViewSeoContent(user)) links.push({ href: '/seo/content', label: 'SEO Content' });
  if (seoTechnicalEnabled() && canViewSeoTechnical(user)) links.push({ href: '/seo/technical', label: 'SEO Technical' });
  if (seoReportsEnabled() && canViewSeoReports(user)) links.push({ href: '/seo/reports', label: 'SEO Reports' });
  if (seoStrategyEnabled() && canViewSeoStrategy(user)) links.push({ href: '/seo/strategy', label: 'SEO Strategy' });
  if (seoGovernanceEnabled() && canViewSeoGovernance(user)) links.push({ href: '/seo/governance', label: 'SEO Governance' });
  if (seoAeoEnabled() && canViewSeoAeo(user)) links.push({ href: '/seo/aeo', label: 'AEO Console' });
  if (seoAuthorityEnabled() && canViewSeoAuthority(user)) links.push({ href: '/seo/authority', label: 'Authority' });
  if (seoRanksEnabled() && canViewSeoRanks(user)) links.push({ href: '/seo/ranks', label: 'Rank Tracker' });
  if (seoAutomationsEnabled() && canViewSeoAutomations(user)) links.push({ href: '/seo/automations', label: 'Automations' });
  if (seoFreshnessEnabled() && canViewSeoFreshness(user)) links.push({ href: '/seo/freshness', label: 'Freshness' });
  if (seoExperimentsEnabled() && canViewSeoExperiments(user)) links.push({ href: '/seo/experiments', label: 'Experiments' });
  if (seoBiEnabled() && canViewSeoBi(user)) links.push({ href: '/seo/bi', label: 'SEO BI' });
  if (seoCmsEnabled() && canViewSeoCms(user)) links.push({ href: '/seo/cms', label: 'CMS Pilot' });
  if (seoGateAEnabled() && canViewSeoGateA(user)) links.push({ href: '/seo/gate-a', label: 'Gate A Go-live' });
  return links;
}

function buildSections(
  user: StoredStaffUser | null,
  emailPendingApprovals?: number,
  agencyUnread?: number,
  reviewQueueCount?: number,
): NavSection[] {
  const sections: NavSection[] = [];

  const overview: NavLink[] = [{ href: '/', label: 'Bảng điều khiển' }];
  if (hasCap(user, 'crm_board', 'view')) {
    overview.push({ href: '/crm', label: 'Bảng CSKH' });
  }
  if (overview.length) sections.push({ label: 'Tổng quan', links: overview, defaultOpen: true });

  const operationalCskh: NavLink[] = [];
  if (hasCap(user, 'crm_leads', 'view')) {
    operationalCskh.push({ href: '/crm/operational/leads', label: 'Lead CSKH vận hành' });
    operationalCskh.push({ href: '/crm/cskh-board', label: 'Bảng CSKH SLA' });
    if (hasCap(user, 'crm_leads', 'assign')) {
      operationalCskh.push({
        href: '/crm/leads/review-queue',
        label: `Phải tra soát (B2)${navBadge(reviewQueueCount)}`,
      });
    }
    if (hasCap(user, 'crm_kpi_records', 'view') || hasCap(user, 'crm_business_dashboard', 'view')) {
      operationalCskh.push({ href: '/crm/gdkd-enterprise', label: 'KPI GDKD Enterprise' });
    }
    if (hasCap(user, 'crm_leads', 'edit')) {
      operationalCskh.push({ href: '/crm/operational/leads/new', label: 'Tạo lead vận hành' });
    }
  }
  if (operationalCskh.length) {
    sections.push({ label: 'CRM · CSKH vận hành', links: operationalCskh, defaultOpen: true });
  }

  const b2bSales: NavLink[] = [];
  if (hasCap(user, 'crm_leads', 'view')) {
    b2bSales.push({ href: '/crm/b2b/leads', label: 'Lead B2B' });
    b2bSales.push({ href: '/crm/b2b-inbox', label: 'Inbox B2B' });
    b2bSales.push({ href: '/crm/intake', label: 'Lead Intake' });
    if (hasCap(user, 'crm_presales_solution', 'view') || hasCap(user, 'crm_leads', 'view')) {
      b2bSales.push({ href: '/crm/solution/queue', label: 'Solution queue' });
    }
    if (hasCap(user, 'crm_leads', 'edit')) {
      b2bSales.push({ href: '/crm/b2b/leads/new', label: 'Tạo lead B2B' });
    }
  }
  if (hasCap(user, 'crm_sales_overview', 'view') || hasCap(user, 'crm_sales_plans', 'view')) {
    b2bSales.push({ href: '/crm/sales', label: 'Kinh doanh' });
  }
  if (hasCap(user, 'crm_board', 'view')) {
    b2bSales.push({ href: '/crm/proposals', label: 'Đề xuất' });
    if (isOpsDvFeEnabled()) {
      b2bSales.push({ href: '/crm/sales/services', label: 'Tra cứu dịch vụ' });
    }
  }
  if (hasCap(user, 'crm_agency', 'view')) {
    b2bSales.push({ href: '/crm/hub', label: 'Hub · Hợp đồng' });
  }
  if (b2bSales.length) {
    sections.push({ label: 'CRM · B2B Sales', links: b2bSales, defaultOpen: true });
  }

  const sharedCrm: NavLink[] = [];
  if (hasCap(user, 'crm_leads', 'view')) {
    sharedCrm.push({ href: '/crm/leads', label: 'Tất cả leads' });
    sharedCrm.push({ href: '/crm/catalog', label: 'Catalog' });
  }
  if (hasCap(user, 'crm_board', 'view')) {
    sharedCrm.push({ href: '/crm/tickets', label: 'Ticket CS' });
  }
  if (hasCap(user, 'crm_board_customers', 'view')) {
    sharedCrm.push({ href: '/crm/customers', label: 'Khách hàng' });
  }
  if (sharedCrm.length) {
    sections.push({ label: 'CRM · Lead chung', links: sharedCrm, defaultOpen: true });
  }

  const salesContract: NavLink[] = [];
  if (hasCap(user, 'crm_board', 'view')) {
    salesContract.push({ href: '/crm/orders', label: 'Đơn hàng' });
  }
  if (hasCap(user, 'crm_re_projects', 'view') || hasCap(user, 'crm_re_projects_products', 'view')) {
    salesContract.push({ href: '/crm/re-projects', label: 'Dự án BĐS' });
  }
  if (hasCap(user, 'crm_b2b_projects', 'view')) {
    salesContract.push({ href: '/crm/b2b-projects', label: 'Dự án PTT' });
    salesContract.push({ href: '/crm/b2b-speed', label: 'Speed-to-lead' });
    salesContract.push({ href: '/crm/b2b-gdkd', label: 'GDKD command center' });
  }
  if (hasCap(user, 'crm_b2b_projects', 'manage')) {
    salesContract.push({ href: '/crm/b2b-unmatched', label: 'Ingress chưa map' });
  }
  if (salesContract.length) {
    sections.push({ label: 'CRM · Bán hàng & Hợp đồng', links: salesContract, defaultOpen: true });
  }

  const plan: NavLink[] = [];
  if (isMarketResearchFeEnabled() && hasCap(user, 'crm_research', 'view')) {
    plan.push({ href: '/crm/research', label: 'Nghiên cứu thị trường' });
    plan.push({ href: '/crm/research/analytics', label: 'Phân tích nghiên cứu' });
    if (shouldShowTaxonomyNav(hasCap(user, 'crm_research', 'configure'))) {
      plan.push({ href: '/crm/research/taxonomy', label: 'Taxonomy' });
    }
  }
  if (hasCap(user, 'crm_board', 'view')) {
    plan.push({ href: '/crm/marketing-plan', label: 'Kế hoạch marketing' });
  }
  if (plan.length) {
    sections.push({ label: 'Lên kế hoạch', links: plan, defaultOpen: true });
  }

  const gtm: NavLink[] = [];
  if (canViewGtmDemos(user)) {
    gtm.push({ href: '/crm/gtm/demos', label: 'Demo PTTCRM' });
  }
  if (canViewGtmCms(user)) {
    gtm.push({ href: '/crm/gtm/cms', label: 'CMS marketing' });
  }
  if (gtm.length) {
    sections.push({ label: 'GTM', links: gtm, defaultOpen: true });
  }

  const delivery: NavLink[] = [];
  if (hasCap(user, 'crm_board', 'view')) {
    delivery.push({ href: '/crm/service-delivery', label: 'Triển khai DV' });
    delivery.push({ href: '/crm/sop', label: 'Quy trình SOP' });
    delivery.push({ href: '/crm/launch-qa', label: 'Launch QA' });
    delivery.push({ href: '/crm/creatives', label: 'Creative Hub' });
    delivery.push({ href: '/crm/campaign-writes', label: 'Campaign Write' });
    if (isOpsDvFeEnabled()) {
      delivery.push({ href: '/crm/ops/catalog', label: 'Catalog DV21' });
      delivery.push({ href: '/crm/ops/dashboard', label: 'Ops Dashboard' });
      delivery.push({ href: '/crm/ops/my-tasks', label: 'Ops tasks' });
      delivery.push({ href: '/crm/ops/alerts', label: 'Ops alerts' });
    }
  }
  if (shouldShowVideoSopNav(user)) {
    delivery.push({ href: '/crm/video', label: 'Video SOP' });
  }
  if (delivery.length) sections.push({ label: 'CRM · Triển khai dịch vụ', links: delivery, defaultOpen: true });

  const hr: NavLink[] = [];
  const canHrHub =
    hasCap(user, 'crm_staff_roster', 'view') ||
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_kpi_records', 'view') ||
    hasCap(user, 'crm_staff_kpi_am_sp', 'view') ||
    hasCap(user, 'crm_data_config', 'view');
  if (canHrHub) {
    hr.push({ href: '/crm/hr', label: 'HR Hub' });
  }
  if (hasCap(user, 'crm_staff_roster', 'view')) {
    hr.push({ href: '/crm/staff', label: 'Nhân viên' });
  }
  if (hasCap(user, 'crm_kpi_records', 'view')) {
    hr.push({ href: '/crm/kpi', label: 'KPI' });
    if (winKpiSolutionEnabled()) {
      hr.push({ href: '/crm/kpi/solution', label: 'KPI Solution' });
    }
    hr.push({ href: '/crm/ai/insights', label: 'AI Insights' });
    hr.push({ href: '/crm/ai/coach', label: 'Coach digest' });
  } else if (hasCap(user, 'crm_business_dashboard', 'view')) {
    hr.push({ href: '/crm/ai/coach', label: 'Coach digest' });
  }
  if (hasCap(user, 'crm_staff_kpi_am_sp', 'view')) {
    hr.push({ href: '/crm/staff-kpi', label: 'KPI AM/SP' });
  }
  if (
    hasCap(user, 'crm_payroll_salary', 'view') ||
    hasCap(user, 'crm_payroll_attendance', 'view') ||
    hasCap(user, 'crm_staff_roster', 'view')
  ) {
    hr.push({ href: '/crm/payroll', label: 'Chấm công & lương' });
  }
  if (hr.length) sections.push({ label: 'Nhân sự & Hiệu suất', links: hr, defaultOpen: true });

  const finance: NavLink[] = [];
  if (hasCap(user, 'crm_business_dashboard', 'view')) {
    finance.push({ href: '/crm/business-dashboard', label: 'Dashboard KD' });
    finance.push({ href: '/crm/forecast', label: 'Forecast' });
    finance.push({ href: '/crm/financials', label: 'Tài chính' });
    finance.push({ href: '/crm/invoices', label: 'Hóa đơn' });
    finance.push({ href: '/crm/ai/query', label: 'NL Analytics' });
  } else if (hasCap(user, 'ai_analytics', 'query')) {
    finance.push({ href: '/crm/ai/query', label: 'NL Analytics' });
  }
  if (hasCap(user, 'crm_agency', 'view') || hasCap(user, 'crm_board', 'view') || hasCap(user, 'ai_admin', 'view')) {
    finance.push({ href: '/crm/health', label: 'CS Health' });
  }
  if (hasCap(user, 'crm_owner_weekly_dashboard', 'view')) {
    finance.push({ href: '/crm/owner-weekly', label: 'BC tuần chủ DN' });
  }
  if (finance.length) sections.push({ label: 'Quản trị & Tài chính', links: finance, defaultOpen: true });

  const agencyClient: NavLink[] = [];
  if (hasCap(user, 'crm_agency', 'view')) {
    agencyClient.push({ href: '/agency', label: 'Agency' });
    agencyClient.push({ href: '/agency/ingest', label: 'Ingest' });
    agencyClient.push({
      href: '/agency/notifications',
      label: `Thông báo${navBadge(agencyUnread)}`,
    });
    agencyClient.push({ href: '/agency/kpi-definitions', label: 'KPI definitions' });
  }
  if (agencyClient.length) sections.push({ label: 'Agency & Client', links: agencyClient, defaultOpen: true });

  const ads: NavLink[] = [];
  const canMetaAds =
    hasCap(user, 'crm_facebook_ads', 'view') ||
    hasCap(user, 'crm_facebook_ads', 'edit') ||
    hasCap(user, 'crm_agency', 'view');
  if (canMetaAds) {
    ads.push({ href: '/meta/facebook-ads', label: 'Meta Ads' });
    if (metaAdsOpsEnabled() && canViewMetaAdsOps(user)) {
      ads.push({ href: '/meta/ads-ops', label: 'Meta Ads Ops' });
    }
    if (metaTrackingEnabled() && canViewMetaTracking(user)) {
      ads.push({ href: '/meta/tracking', label: 'Meta Tracking' });
    }
    if (metaIntelligenceEnabled() && canViewMetaIntelligence(user)) {
      ads.push({ href: '/meta/intelligence', label: 'Meta Intelligence' });
    }
    ads.push({ href: '/meta/migration', label: 'Meta Migration' });
  }
  if (hasCap(user, 'crm_google_ads', 'view') || hasCap(user, 'crm_agency', 'view')) {
    ads.push({ href: '/google/google-ads', label: 'Google Ads' });
    ads.push({ href: '/meta/ads-combined', label: 'Ads CPL' });
  }
  if (hasCap(user, 'crm_zalo_ads', 'view') || hasCap(user, 'crm_agency', 'view')) {
    ads.push({ href: '/zalo/zalo-ads', label: 'Zalo Ads' });
    ads.push({ href: '/zalo/leads', label: 'Zalo Leads' });
  }
  if (ads.length) sections.push({ label: 'Kênh quảng cáo', links: ads });

  const seoLinks = buildSeoLinks(user);
  if (seoLinks.length) sections.push({ label: 'SEO / AEO', links: seoLinks });

  const emailView = hasCap(user, 'crm_email_mkt', 'view') || hasCap(user, 'crm_agency', 'view');
  const emailWrite = hasCap(user, 'crm_email_mkt', 'write') || hasCap(user, 'crm_agency', 'create');
  const emailDeliverability =
    hasCap(user, 'crm_email_mkt', 'deliverability') ||
    hasCap(user, 'crm_email_mkt', 'settings') ||
    hasCap(user, 'crm_agency', 'create');
  const emailReports =
    hasCap(user, 'crm_email_mkt', 'reports') ||
    hasCap(user, 'crm_email_mkt', 'write') ||
    hasCap(user, 'crm_agency', 'view');

  if (emailView && emailModuleEnabled()) {
    const email: NavLink[] = [
      { href: '/email/hub', label: `Email Hub${navBadge(emailPendingApprovals)}` },
      { href: '/email/clients', label: 'Email Clients' },
      { href: '/email/contacts', label: 'Contacts' },
      { href: '/email/consent', label: 'Consent' },
      { href: '/email/suppression', label: 'Suppression' },
      { href: '/email/governance', label: 'Governance' },
    ];
    if (emailWrite) {
      email.push({ href: '/email/segments', label: 'Segments' });
      email.push({ href: '/email/templates', label: 'Templates' });
      email.push({ href: '/email/campaigns', label: `Campaigns${navBadge(emailPendingApprovals)}` });
    }
    if (emailJourneysEnabled() && emailWrite) {
      email.push({ href: '/email/journeys', label: 'Journeys' });
    }
    if (emailDeliverability) {
      email.push({ href: '/email/deliverability', label: 'Deliverability' });
    }
    if (emailReports) {
      email.push({ href: '/email/reports', label: 'Reports' });
    }
    if (emailGateAEnabled() && canViewEmailGateA(user)) {
      email.push({ href: '/email/gate-a', label: 'Gate A Prod pilot' });
    }
    sections.push({ label: 'Email Marketing', links: email });
  }

  const aiAutomation: NavLink[] = [];
  if (hasCap(user, 'automation_workflows', 'view')) {
    aiAutomation.push({ href: '/crm/automation', label: 'Workflows' });
  }
  if (hasCap(user, 'playbooks', 'view')) {
    aiAutomation.push({ href: '/crm/playbooks', label: 'Playbooks' });
  }
  if (aiAutomation.length) sections.push({ label: 'AI & Automation', links: aiAutomation });

  if (canViewAdminSection(user)) {
    const adminLinks = buildAdminSidebarLinks(user);
    if (adminLinks.length) {
      sections.push({
        label: 'Quản trị hệ thống',
        links: adminLinks.map((l) => ({ href: l.href, label: l.label })),
        defaultOpen: false,
      });
    }
  }

  return sections;
}

function sectionHasActive(pathname: string, section: NavSection): boolean {
  return section.links.some((link) => isActive(pathname, link.href));
}

function userInitials(user: StoredStaffUser | null): string {
  const name = user?.display_name?.trim() || user?.email?.trim() || '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function OpsNav({ user, onLogout, emailPendingApprovals, agencyUnread }: OpsNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [reviewQueueCount, setReviewQueueCount] = useState<number | undefined>();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [flyoutSection, setFlyoutSection] = useState<string | null>(null);
  const [isMobileNav, setIsMobileNav] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 960px)');
    const apply = () => setIsMobileNav(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    const expanded = readSidebarExpanded();
    setSidebarExpanded(expanded);
    applyShellClasses(expanded);
  }, []);

  useEffect(() => {
    setFlyoutSection(null);
  }, [pathname]);

  useEffect(() => {
    if (!user || !hasCap(user, 'crm_leads', 'assign')) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchReviewQueueCount(token)
      .then((out) => setReviewQueueCount(out.count))
      .catch(() => setReviewQueueCount(undefined));
  }, [user, pathname]);

  const sections = buildSections(user, emailPendingApprovals, agencyUnread, reviewQueueCount);

  const showExpandedNav = sidebarExpanded || isMobileNav;

  function toggleSidebar() {
    setSidebarExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? '1' : '0');
      }
      applyShellClasses(next);
      if (!next) setFlyoutSection(null);
      return next;
    });
  }

  function navigateTo(href: string) {
    setFlyoutSection(null);
    if (!isActive(pathname, href)) {
      router.push(href);
    }
  }

  const drawerSection = flyoutSection
    ? sections.find((section) => section.label === flyoutSection) ?? null
    : null;

  return (
    <>
      <aside
        className={`ops-sidebar${showExpandedNav ? ' ops-sidebar--expanded' : ' ops-sidebar--rail'}`}
        aria-label="Điều hướng chính"
      >
        <div className="ops-sidebar-brand">
          <span className="ops-sidebar-brand-mark">PTT</span>
          <div className="ops-sidebar-brand-text">
            <strong>PTT CRM</strong>
            <span>RNOSAI · Bitrix-style</span>
          </div>
        </div>
        <nav className={`ops-sidebar-nav${showExpandedNav ? ' is-expanded' : ' is-collapsed-rail'}`}>
          {showExpandedNav ? (
            sections.map((section) => {
              const shortLabel = sectionShortLabel(section.label);
              return (
                <div
                  key={section.label}
                  className={`ops-nav-group is-open${sectionHasActive(pathname, section) ? ' has-active' : ''}`}
                >
                  <div className="ops-nav-group-header ops-nav-group-header--static">
                    <span className="ops-nav-group-icon">
                      <NavIcon name={sectionIcon(section.label)} />
                    </span>
                    <span className="ops-nav-group-label">{shortLabel}</span>
                  </div>
                  <div className="ops-nav-group-links">
                    {section.links.map((link) => (
                      <button
                        key={link.href}
                        type="button"
                        className={`ops-nav-link ops-nav-link--text ops-nav-link--button${isActive(pathname, link.href) ? ' is-active' : ''}`}
                        onClick={() => navigateTo(link.href)}
                      >
                        {link.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="ops-nav-rail">
              {sections.map((section) => {
                const shortLabel = sectionShortLabel(section.label);
                const active = sectionHasActive(pathname, section);
                const open = flyoutSection === section.label;
                return (
                  <div
                    key={section.label}
                    className={`ops-nav-rail-item${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="ops-nav-rail-btn"
                      title={shortLabel}
                      aria-label={shortLabel}
                      aria-expanded={open}
                      onClick={() => setFlyoutSection((prev) => (prev === section.label ? null : section.label))}
                    >
                      <NavIcon name={sectionIcon(section.label)} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>
        <div className="ops-sidebar-footer">
          <button
            type="button"
            className="ops-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
            title={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
          >
            {sidebarExpanded ? '«' : '»'}
          </button>
        </div>
      </aside>

      {!showExpandedNav && drawerSection ? (
        <>
          <button
            type="button"
            className="ops-nav-drawer-backdrop"
            aria-label="Đóng menu"
            onClick={() => setFlyoutSection(null)}
          />
          <nav className="ops-nav-drawer" aria-label={sectionShortLabel(drawerSection.label)}>
            <div className="ops-nav-drawer-head">
              <strong>{sectionShortLabel(drawerSection.label)}</strong>
              <button type="button" className="ops-nav-drawer-close" onClick={() => setFlyoutSection(null)}>
                ×
              </button>
            </div>
            <div className="ops-nav-drawer-links">
              {drawerSection.links.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  className={`ops-nav-drawer-link${isActive(pathname, link.href) ? ' is-active' : ''}`}
                  onClick={() => navigateTo(link.href)}
                >
                  <span className="ops-nav-drawer-link-icon">
                    <NavIcon name={iconForHref(link.href)} />
                  </span>
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </>
      ) : null}

      <header className="ops-topbar">
        <div className="ops-topbar-strip" aria-hidden="true" />
        <div className="ops-topbar-inner">
          <div className="ops-topbar-app">
            <button
              type="button"
              className="ops-sidebar-toggle ops-sidebar-toggle--topbar"
              onClick={toggleSidebar}
              aria-label={sidebarExpanded ? 'Thu gọn menu' : 'Mở rộng menu'}
            >
              ☰
            </button>
            <span className="ops-topbar-app-name">PTT CRM</span>
          </div>
          <GlobalSearchBar />
          <div className="ops-topbar-user">
            {user && (winPayslipPortalEnabled() || winLeaveLiteEnabled()) ? (
              <StaffNotificationBell />
            ) : null}
            <div className="ops-topbar-user-meta">
              <strong>{user?.display_name ?? user?.email ?? 'Staff'}</strong>
              <WinRbacBadge user={user} />
              <WinRbacBadge user={user} className="win-badge-rbac--mobile" />
              <span>{pageTitleFor(pathname)}</span>
            </div>
            <span className="ops-topbar-avatar" aria-hidden="true">
              {userInitials(user)}
            </span>
            <button type="button" className="btn btn-sm btn-secondary btn-topbar-logout" onClick={onLogout}>
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
