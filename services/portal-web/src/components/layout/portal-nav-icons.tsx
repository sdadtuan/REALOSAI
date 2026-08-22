import type { ReactNode } from 'react';
import type { PortalNavSection } from '@/lib/portal/nav';

type IconName =
  | 'overview'
  | 'channels'
  | 'workflow'
  | 'seo'
  | 'email'
  | 'settings'
  | 'meta'
  | 'google'
  | 'zalo'
  | 'creatives'
  | 'notifications'
  | 'dashboard'
  | 'generic';

const PATH_ICON: Record<string, IconName> = {
  '/dashboard': 'dashboard',
  '/meta': 'meta',
  '/google': 'google',
  '/zalo': 'zalo',
  '/creatives': 'creatives',
  '/notifications': 'notifications',
  '/settings': 'settings',
  '/seo': 'seo',
  '/seo/reports': 'seo',
  '/seo/content': 'seo',
  '/email': 'email',
  '/email/approvals': 'email',
};

const SECTION_ICON: Record<string, IconName> = {
  overview: 'overview',
  channels: 'channels',
  workflow: 'workflow',
  seo: 'seo',
  email: 'email',
  settings: 'settings',
};

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

export function PortalNavIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'overview':
    case 'dashboard':
      return (
        <Svg>
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    case 'channels':
      return (
        <Svg>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M3 10h18" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'workflow':
    case 'creatives':
      return (
        <Svg>
          <path d="M5 7h14M5 12h10M5 17h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'notifications':
      return (
        <Svg>
          <path d="M12 4a4 4 0 0 1 4 4v3l2 2v1H6v-1l2-2V8a4 4 0 0 1 4-4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'seo':
      return (
        <Svg>
          <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'email':
      return (
        <Svg>
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="m3 8 9 6 9-6" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </Svg>
      );
    case 'settings':
      return (
        <Svg>
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    case 'meta':
      return (
        <Svg>
          <path d="M12 3c4 2.5 7 6 7 9s-3 6.5-7 9c-4-2.5-7-6.5-7-9s3-6.5 7-9Z" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'google':
      return (
        <Svg>
          <path d="M12 4v8l6 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
    case 'zalo':
      return (
        <Svg>
          <path d="M6 6h12v12H6z" stroke="currentColor" strokeWidth="1.6" />
          <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </Svg>
      );
    default:
      return (
        <Svg>
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
        </Svg>
      );
  }
}

export function portalSectionIcon(section: PortalNavSection): IconName {
  return SECTION_ICON[section.id] ?? 'generic';
}

export function portalLinkIcon(href: string): IconName {
  return PATH_ICON[href] ?? 'generic';
}
