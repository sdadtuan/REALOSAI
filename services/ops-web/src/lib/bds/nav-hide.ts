import type { BdsTenantMode } from './nav';
import { fetchBdsTenantMe, getBdsTenantMode } from './api';
import { isBdsNavHideB2bFeEnabled } from './flags';

export const B2B_NAV_PREFIXES = [
  '/crm/sales',
  '/crm/b2b',
  '/crm/b2b-inbox',
  '/crm/intake',
  '/crm/solution',
  '/crm/gdkd-enterprise',
  '/crm/b2b-projects',
  '/crm/b2b-speed',
  '/crm/b2b-gdkd',
] as const;

export function shouldHideB2bNav(
  mode: BdsTenantMode | null | undefined,
  hideFlag: boolean,
): boolean {
  if (!hideFlag) return false;
  return mode === 'developer' || mode === 'hybrid';
}

export function isB2bNavHref(href: string): boolean {
  const path = String(href ?? '').split('?')[0];
  return B2B_NAV_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function filterB2bNavLinks<T extends { href: string }>(links: T[], hide: boolean): T[] {
  if (!hide) return links;
  return links.filter((link) => !isB2bNavHref(link.href));
}

export function filterB2bNavSections<T extends { links: Array<{ href: string }> }>(
  sections: T[],
  hide: boolean,
): T[] {
  if (!hide) return sections;
  return sections
    .map((section) => ({ ...section, links: filterB2bNavLinks(section.links, true) }))
    .filter((section) => section.links.length > 0);
}

export function bdsB2bPageForbidden(
  mode: BdsTenantMode | null | undefined,
  hideFlag: boolean,
): boolean {
  return shouldHideB2bNav(mode, hideFlag);
}

export async function resolveB2bPageForbidden(token: string): Promise<boolean> {
  if (!isBdsNavHideB2bFeEnabled()) return false;
  let mode = getBdsTenantMode() as BdsTenantMode | null;
  if (!mode) {
    try {
      const me = await fetchBdsTenantMe(token);
      mode = me.mode;
    } catch {
      return false;
    }
  }
  return bdsB2bPageForbidden(mode, true);
}
