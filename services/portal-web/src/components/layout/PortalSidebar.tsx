'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { PortalSettingsResponse } from '@/lib/api';
import {
  buildPortalNavSections,
  portalNavIsActive,
  portalSectionHasActive,
  type PortalNavSection,
} from '@/lib/portal/nav';
import type { StoredUser } from '@/lib/auth';
import { PortalNavIcon, portalLinkIcon, portalSectionIcon } from './portal-nav-icons';

const SIDEBAR_STORAGE_KEY = 'portal-sidebar-expanded';

function readSidebarExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
}

function applyShellClasses(expanded: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('portal-shell-expanded', expanded);
  document.documentElement.classList.toggle('portal-shell-collapsed', !expanded);
}

export type PortalSidebarProps = {
  user: StoredUser | null;
  pendingCount?: number;
  notificationUnread?: number;
  emailPending?: number;
  seoPending?: number;
  branding?: PortalSettingsResponse | null;
  seoEnabled?: boolean;
  emailEnabled?: boolean;
  onToggleSidebar?: () => void;
  sidebarExpanded?: boolean;
};

export function PortalSidebar({
  user,
  pendingCount = 0,
  notificationUnread = 0,
  emailPending = 0,
  seoPending = 0,
  branding,
  seoEnabled = false,
  emailEnabled = false,
  onToggleSidebar,
  sidebarExpanded: controlledExpanded,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [flyoutSection, setFlyoutSection] = useState<string | null>(null);
  const [isMobileNav, setIsMobileNav] = useState(false);

  const sidebarExpanded = controlledExpanded ?? internalExpanded;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobileNav(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (controlledExpanded !== undefined) return;
    const expanded = readSidebarExpanded();
    setInternalExpanded(expanded);
    applyShellClasses(expanded);
  }, [controlledExpanded]);

  useEffect(() => {
    setFlyoutSection(null);
  }, [pathname]);

  const sections = buildPortalNavSections({
    user,
    pendingCount,
    notificationUnread,
    emailPending,
    seoPending,
    seoEnabled,
    emailEnabled,
  });

  const showExpandedNav = sidebarExpanded || isMobileNav;
  const displayName = branding?.display_name ?? branding?.client_name ?? 'Client Portal';

  function toggleSidebar() {
    if (onToggleSidebar) {
      onToggleSidebar();
      return;
    }
    setInternalExpanded((prev) => {
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
    if (isMobileNav && sidebarExpanded) {
      if (onToggleSidebar) {
        onToggleSidebar();
      } else {
        setInternalExpanded(false);
        applyShellClasses(false);
      }
    }
    if (!portalNavIsActive(pathname, href)) {
      router.push(href);
    }
  }

  const drawerSection: PortalNavSection | null = flyoutSection
    ? sections.find((section) => section.id === flyoutSection) ?? null
    : null;

  return (
    <>
      {isMobileNav && sidebarExpanded ? (
        <button
          type="button"
          className="portal-nav-drawer-backdrop"
          aria-label="Đóng menu"
          onClick={toggleSidebar}
        />
      ) : null}
      <aside
        className={`portal-sidebar${showExpandedNav ? ' portal-sidebar--expanded' : ' portal-sidebar--rail'}`}
        aria-label="Điều hướng chính"
      >
        <div className="portal-sidebar-brand">
          {branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo_url} alt="" className="portal-sidebar-brand-logo" />
          ) : (
            <span className="portal-sidebar-brand-mark">PTT</span>
          )}
          <div className="portal-sidebar-brand-text">
            <strong>{displayName}</strong>
            <span>Client portal</span>
          </div>
        </div>

        <nav className={`portal-sidebar-nav${showExpandedNav ? ' is-expanded' : ' is-collapsed-rail'}`}>
          {showExpandedNav ? (
            sections.map((section) => (
              <div
                key={section.id}
                className={`portal-nav-group is-open${portalSectionHasActive(pathname, section) ? ' has-active' : ''}`}
              >
                <div className="portal-nav-group-header portal-nav-group-header--static">
                  <span className="portal-nav-group-icon">
                    <PortalNavIcon name={portalSectionIcon(section)} />
                  </span>
                  <span className="portal-nav-group-label">{section.shortLabel}</span>
                </div>
                <div className="portal-nav-group-links">
                  {section.links.map((link) => (
                    <button
                      key={link.href}
                      type="button"
                      className={`portal-nav-link portal-nav-link--button${portalNavIsActive(pathname, link.href) ? ' is-active' : ''}`}
                      onClick={() => navigateTo(link.href)}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="portal-nav-rail">
              {sections.map((section) => {
                const active = portalSectionHasActive(pathname, section);
                const open = flyoutSection === section.id;
                return (
                  <div
                    key={section.id}
                    className={`portal-nav-rail-item${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
                  >
                    <button
                      type="button"
                      className="portal-nav-rail-btn"
                      title={section.shortLabel}
                      aria-label={section.shortLabel}
                      aria-expanded={open}
                      onClick={() => setFlyoutSection((prev) => (prev === section.id ? null : section.id))}
                    >
                      <PortalNavIcon name={portalSectionIcon(section)} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        <div className="portal-sidebar-footer">
          <button
            type="button"
            className="portal-sidebar-toggle"
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
            className="portal-nav-drawer-backdrop"
            aria-label="Đóng menu"
            onClick={() => setFlyoutSection(null)}
          />
          <nav className="portal-nav-drawer" aria-label={drawerSection.shortLabel}>
            <div className="portal-nav-drawer-head">
              <strong>{drawerSection.label}</strong>
              <button type="button" className="portal-nav-drawer-close" onClick={() => setFlyoutSection(null)}>
                ×
              </button>
            </div>
            <div className="portal-nav-drawer-links">
              {drawerSection.links.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  className={`portal-nav-drawer-link${portalNavIsActive(pathname, link.href) ? ' is-active' : ''}`}
                  onClick={() => navigateTo(link.href)}
                >
                  <span className="portal-nav-drawer-link-icon">
                    <PortalNavIcon name={portalLinkIcon(link.href)} />
                  </span>
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
          </nav>
        </>
      ) : null}
    </>
  );
}

export { readSidebarExpanded, applyShellClasses, SIDEBAR_STORAGE_KEY };
