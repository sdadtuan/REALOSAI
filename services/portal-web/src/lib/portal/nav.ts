import type { StoredUser } from '@/lib/auth';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { isOpsPortalSummaryFeEnabled } from '@/lib/ops-portal-flags';

export type PortalNavLink = { href: string; label: string; badge?: number };

export type PortalNavSection = {
  id: string;
  label: string;
  shortLabel: string;
  links: PortalNavLink[];
};

export type PortalNavContext = {
  user: StoredUser | null;
  pendingCount?: number;
  notificationUnread?: number;
  emailPending?: number;
  seoPending?: number;
  seoEnabled?: boolean;
  emailEnabled?: boolean;
};

function badgeSuffix(count: number | undefined): string {
  if (!count || count <= 0) return '';
  return count > 99 ? ' (99+)' : ` (${count})`;
}

export function buildPortalNavSections(ctx: PortalNavContext): PortalNavSection[] {
  const {
    user,
    pendingCount = 0,
    notificationUnread = 0,
    emailPending = 0,
    seoPending = 0,
    seoEnabled = false,
    emailEnabled = false,
  } = ctx;

  const sections: PortalNavSection[] = [
    {
      id: 'overview',
      label: 'Tổng quan',
      shortLabel: 'Home',
      links: [{ href: '/dashboard', label: 'Performance tổng hợp' }],
    },
    {
      id: 'channels',
      label: 'Kênh quảng cáo',
      shortLabel: 'Ads',
      links: [
        { href: '/meta', label: 'Meta (Facebook / IG)' },
        { href: '/google', label: 'Google Ads' },
        { href: '/zalo', label: 'Zalo Ads' },
      ],
    },
    {
      id: 'workflow',
      label: 'Duyệt & thông báo',
      shortLabel: 'Duyệt',
      links: [
        {
          href: '/creatives',
          label: `Creative inbox${badgeSuffix(pendingCount)}`,
          badge: pendingCount,
        },
        {
          href: '/notifications',
          label: `Thông báo${badgeSuffix(notificationUnread)}`,
          badge: notificationUnread,
        },
      ],
    },
  ];

  if (seoEnabled) {
    sections.push({
      id: 'seo',
      label: 'SEO / AEO',
      shortLabel: 'SEO',
      links: [
        { href: '/seo', label: 'SEO dashboard' },
        { href: '/seo/reports', label: 'SEO reports' },
        {
          href: '/seo/content',
          label: `SEO review${badgeSuffix(seoPending)}`,
          badge: seoPending,
        },
      ],
    });
  }

  if (emailEnabled) {
    const emailLinks: PortalNavLink[] = [{ href: '/email', label: 'Email dashboard' }];
    if (user?.role === 'approver') {
      emailLinks.push({
        href: '/email/approvals',
        label: `Email approvals${badgeSuffix(emailPending)}`,
        badge: emailPending,
      });
    }
    sections.push({
      id: 'email',
      label: 'Email marketing',
      shortLabel: 'Email',
      links: emailLinks,
    });
  }

  if (isOpsPortalSummaryFeEnabled()) {
    sections.splice(1, 0, {
      id: 'service-delivery',
      label: 'Triển khai dịch vụ',
      shortLabel: 'DV',
      links: [{ href: '/service-delivery', label: 'Tiến độ & KPI' }],
    });
  }

  if (isMarketResearchPortalFeEnabled()) {
    sections.push({
      id: 'research',
      label: 'Nghiên cứu',
      shortLabel: 'NC',
      links: [{ href: '/research', label: 'Báo cáo nghiên cứu' }],
    });
  }

  sections.push({
    id: 'settings',
    label: 'Cài đặt',
    shortLabel: 'Cài đặt',
    links: [{ href: '/settings', label: 'Tài khoản & thông báo' }],
  });

  return sections;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Performance tổng hợp',
  '/meta': 'Meta Performance',
  '/google': 'Google Performance',
  '/zalo': 'Zalo Performance',
  '/creatives': 'Creative inbox',
  '/notifications': 'Thông báo',
  '/settings': 'Cài đặt',
  '/seo': 'SEO / AEO',
  '/seo/reports': 'SEO Reports',
  '/seo/content': 'SEO Content review',
  '/email': 'Email dashboard',
  '/email/approvals': 'Email approvals',
  '/service-delivery': 'Triển khai dịch vụ',
  '/research': 'Báo cáo nghiên cứu',
};

export function portalPageTitle(pathname: string): string {
  if (pathname.startsWith('/email/campaigns/')) return 'Campaign performance';
  if (pathname.startsWith('/seo/content/') && pathname !== '/seo/content') return 'SEO content detail';
  if (pathname.startsWith('/research/') && pathname !== '/research') return 'Báo cáo nghiên cứu';
  return PAGE_TITLES[pathname] ?? 'Client Portal';
}

export function portalNavIsActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

export function portalSectionHasActive(pathname: string, section: PortalNavSection): boolean {
  return section.links.some((link) => portalNavIsActive(pathname, link.href));
}
