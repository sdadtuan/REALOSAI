import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';
import { canViewBdsHub, hasAnyBdsCap } from './caps';
import { isStaffChatFeEnabled } from '@/lib/staff-chat/flags';
import { isBdsUiFeEnabled } from './flags';

export type BdsTenantMode = 'developer' | 'broker' | 'hybrid';

export type BdsNavLink = { href: string; label: string };
export type BdsNavSection = { label: string; links: BdsNavLink[]; defaultOpen?: boolean };

export function hubHomeHref(mode: BdsTenantMode): string {
  return mode === 'broker' ? '/crm/bds/basket' : '/crm/bds';
}

export function modeBadgeLabel(mode: BdsTenantMode): string {
  if (mode === 'broker') return 'Sàn';
  if (mode === 'hybrid') return 'Hybrid';
  return 'CĐT';
}

function buildDeveloperLinks(user: StoredStaffUser | null, mode: BdsTenantMode): BdsNavLink[] {
  const links: BdsNavLink[] = [];
  if (canViewBdsHub(user)) {
    links.push({ href: '/crm/bds', label: 'Tổng quan' });
  }
  if (hasCap(user, 'crm_re_projects', 'view') || hasCap(user, 'bds_inventory', 'view')) {
    links.push({ href: '/crm/re-projects', label: 'Dự án' });
  }
  if (hasCap(user, 'bds_buyers', 'view')) {
    links.push({ href: '/crm/bds/leads', label: 'Lead khách mua' });
  }
  if (hasCap(user, 'bds_holds', 'view')) {
    links.push({ href: '/crm/bds/holds', label: 'Hold' });
  }
  if (hasCap(user, 'bds_launches', 'view')) {
    links.push({ href: '/crm/bds/launches', label: 'Ra quân' });
  }
  if (hasCap(user, 'bds_transactions', 'view')) {
    links.push({ href: '/crm/bds/transactions', label: 'Giao dịch' });
  }
  if (hasCap(user, 'bds_agencies', 'view')) {
    links.push({ href: '/crm/bds/agencies', label: 'Mạng' });
  }
  if (hasCap(user, 'bds_agency_tiers', 'view')) {
    links.push({ href: '/crm/bds/tiers', label: 'Hạng' });
    links.push({ href: '/crm/bds/leaderboard', label: 'Bảng xếp hạng' });
  }
  if (hasCap(user, 'bds_collections', 'view')) {
    links.push({ href: '/crm/bds/collections', label: 'Công nợ' });
  }
  if (hasCap(user, 'bds_aftersales', 'view')) {
    links.push({ href: '/crm/bds/aftersales', label: 'Sau bán' });
  }
  if (hasCap(user, 'bds_commission', 'view')) {
    links.push({ href: '/crm/bds/commissions', label: 'Hoa hồng' });
  }
  if (mode === 'hybrid' && hasCap(user, 'bds_baskets', 'view')) {
    links.push({ href: '/crm/bds/basket', label: 'Sàn nội bộ' });
  }
  if (isStaffChatFeEnabled() && hasCap(user, 'staff_chat', 'view')) {
    links.push({ href: '/crm/chat', label: 'Chat' });
  }
  return links;
}

function buildBrokerLinks(user: StoredStaffUser | null): BdsNavLink[] {
  const links: BdsNavLink[] = [];
  if (hasCap(user, 'bds_baskets', 'view')) {
    links.push({ href: '/crm/bds/basket', label: 'Giỏ hàng' });
  }
  if (hasCap(user, 'bds_buyers', 'view')) {
    links.push({ href: '/crm/bds/leads', label: 'Lead' });
  }
  if (hasCap(user, 'bds_holds', 'view')) {
    links.push({ href: '/crm/bds/holds', label: 'Hold' });
  }
  if (hasCap(user, 'bds_commission', 'view')) {
    links.push({ href: '/crm/bds/commissions', label: 'Hoa hồng' });
  }
  if (isStaffChatFeEnabled() && hasCap(user, 'staff_chat', 'view')) {
    links.push({ href: '/crm/chat', label: 'Chat' });
  }
  return links;
}

export function buildBdsNavSections(
  user: StoredStaffUser | null,
  mode: BdsTenantMode,
): BdsNavSection[] {
  if (!isBdsUiFeEnabled() || !hasAnyBdsCap(user)) return [];
  const links = mode === 'broker' ? buildBrokerLinks(user) : buildDeveloperLinks(user, mode);
  if (!links.length) return [];
  return [{ label: 'BĐS', links, defaultOpen: true }];
}
