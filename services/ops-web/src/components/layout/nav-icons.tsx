/** Sidebar icons — one distinct glyph per route where possible. */
import type { ReactNode } from 'react';

type IconProps = {
  width?: number;
  height?: number;
  className?: string;
};

function Svg({ children, width = 20, height = 20, className }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const GLYPHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5z" />,
  board: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  leads: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  sla: <path d="M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />,
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  ticket: (
    <>
      <path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3 3 3 0 0 0-3 3v1" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  customers: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  catalog: (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.3 7 12 12l8.7-5M12 22V12" />
    </>
  ),
  hub: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </>
  ),
  sales: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  proposal: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  order: (
    <>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M6 21V7l6-4 6 4v14M10 21v-6h4v6" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  lifecycle: <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
  checklist: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  rocket: (
    <>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </>
  ),
  creative: (
    <>
      <circle cx="13.5" cy="6.5" r="2.5" />
      <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </>
  ),
  megaphone: (
    <>
      <path d="m3 11 18-5v12L3 13v-2z" />
      <path d="M11 13v8a2 2 0 0 0 4 0v-1" />
    </>
  ),
  staff: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  kpi: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 5-6" />
    </>
  ),
  payroll: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20M7 15h.01M11 15h2" />
    </>
  ),
  insight: (
    <>
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
    </>
  ),
  coach: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </>
  ),
  query: (
    <>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </>
  ),
  dashboard: (
    <>
      <path d="M3 3v8h8V3zM13 3v5h8V3zM13 12v9h8v-9zM3 16v5h8v-5z" />
    </>
  ),
  forecast: <path d="M3 3v18h18M7 16l4-4 4 4 6-8" />,
  finance: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  invoice: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </>
  ),
  health: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  report: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 18v-4M12 18v-7M16 18v-2" />
    </>
  ),
  agency: <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />,
  ingest: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  metric: (
    <>
      <path d="M12 20V10M18 20V4M6 20v-4" />
    </>
  ),
  meta: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  ops: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2" />
    </>
  ),
  tracking: (
    <>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  intel: (
    <>
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
      <path d="M9 21h6" />
    </>
  ),
  migrate: (
    <>
      <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
    </>
  ),
  google: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2 8 4-8 4-8-4 8-4zM2 12l10 5 10-5M2 17l10 5 10-5" />
    </>
  ),
  zalo: (
    <>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </>
  ),
  zaloLead: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-4M20 9v4" />
    </>
  ),
  seo: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  seoDoc: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </>
  ),
  seoTech: (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
  seoChart: (
    <>
      <path d="M3 3v18h18" />
      <path d="M18 17V9M13 17V5M8 17v-3" />
    </>
  ),
  seoCompass: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </>
  ),
  seoShield: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>
  ),
  seoSpark: (
    <>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </>
  ),
  seoRank: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16l3-6 3 3 4-7" />
    </>
  ),
  seoBot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h.01M15 14h.01" />
    </>
  ),
  seoClock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  seoFlask: (
    <>
      <path d="M9 3h6M10 3v6.76a6 6 0 1 0 4 0V3" />
    </>
  ),
  seoGrid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  seoPublish: (
    <>
      <path d="M12 3v12M8 7l4-4 4 4M5 21h14" />
    </>
  ),
  seoGate: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  email: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  contacts: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  consent: (
    <>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  suppress: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </>
  ),
  govern: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </>
  ),
  segment: (
    <>
      <path d="M21 12a9 9 0 1 1-9-9" />
      <path d="M21 3v6h-6" />
    </>
  ),
  template: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </>
  ),
  campaign: (
    <>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z" />
    </>
  ),
  journey: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 6h8a4 4 0 0 1 4 4v4" />
    </>
  ),
  deliver: (
    <>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      <path d="M5 12H2" />
    </>
  ),
  workflow: (
    <>
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v3h12V9M12 12v3" />
    </>
  ),
  playbook: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </>
  ),
  agent: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h.01M15 14h.01" />
    </>
  ),
  run: (
    <>
      <polygon points="5 3 19 12 5 21 5 3" />
    </>
  ),
  tool: (
    <>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </>
  ),
  fields: (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </>
  ),
  pipeline: (
    <>
      <path d="M3 6h18M3 12h12M3 18h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  dot: <circle cx="12" cy="12" r="2" />,
};

export function NavIcon({ name }: { name: string }) {
  return <Svg>{GLYPHS[name] ?? GLYPHS.dot}</Svg>;
}

export function iconForHref(href: string): string {
  return LINK_ICONS[href] ?? 'dot';
}

export const LINK_ICONS: Record<string, string> = {
  '/': 'home',
  '/crm': 'board',
  '/crm/leads': 'leads',
  '/crm/operational/leads': 'sla',
  '/crm/b2b/leads': 'sales',
  '/crm/operational/leads/new': 'leads',
  '/crm/b2b/leads/new': 'sales',
  '/crm/cskh-board': 'sla',
  '/crm/gdkd-enterprise': 'kpi',
  '/crm/intake': 'checklist',
  '/crm/leads/review-queue': 'inbox',
  '/crm/solution/queue': 'inbox',
  '/crm/tickets': 'ticket',
  '/crm/customers': 'customers',
  '/crm/catalog': 'catalog',
  '/crm/hub': 'hub',
  '/crm/sales': 'sales',
  '/crm/sales/services': 'catalog',
  '/crm/proposals': 'proposal',
  '/crm/orders': 'order',
  '/crm/re-projects': 'building',
  '/crm/b2b-projects': 'briefcase',
  '/crm/b2b-inbox': 'inbox',
  '/crm/research': 'search',
  '/crm/research/analytics': 'kpi',
  '/crm/research/taxonomy': 'catalog',
  '/crm/marketing-plan': 'calendar',
  '/crm/service-delivery': 'lifecycle',
  '/crm/sop': 'checklist',
  '/crm/video': 'run',
  '/crm/launch-qa': 'rocket',
  '/crm/creatives': 'creative',
  '/crm/campaign-writes': 'megaphone',
  '/crm/hr': 'staff',
  '/crm/staff': 'staff',
  '/crm/kpi': 'kpi',
  '/crm/staff-kpi': 'metric',
  '/crm/payroll': 'payroll',
  '/crm/ai/insights': 'insight',
  '/crm/ai/coach': 'coach',
  '/crm/business-dashboard': 'dashboard',
  '/crm/forecast': 'forecast',
  '/crm/financials': 'finance',
  '/crm/invoices': 'invoice',
  '/crm/health': 'health',
  '/crm/owner-weekly': 'report',
  '/crm/ai/query': 'query',
  '/agency': 'agency',
  '/agency/ingest': 'ingest',
  '/agency/notifications': 'bell',
  '/agency/kpi-definitions': 'metric',
  '/meta/facebook-ads': 'meta',
  '/meta/ads-ops': 'ops',
  '/meta/tracking': 'tracking',
  '/meta/intelligence': 'intel',
  '/meta/migration': 'migrate',
  '/google/google-ads': 'google',
  '/meta/ads-combined': 'layers',
  '/zalo/zalo-ads': 'zalo',
  '/zalo/leads': 'zaloLead',
  '/seo/hub': 'seo',
  '/seo/clients': 'customers',
  '/seo/research': 'seo',
  '/seo/content': 'seoDoc',
  '/seo/technical': 'seoTech',
  '/seo/reports': 'seoChart',
  '/seo/strategy': 'seoCompass',
  '/seo/governance': 'seoShield',
  '/seo/aeo': 'seoSpark',
  '/seo/authority': 'seoRank',
  '/seo/ranks': 'seoRank',
  '/seo/automations': 'seoBot',
  '/seo/freshness': 'seoClock',
  '/seo/experiments': 'seoFlask',
  '/seo/bi': 'seoGrid',
  '/seo/cms': 'seoPublish',
  '/seo/gate-a': 'seoGate',
  '/email/hub': 'email',
  '/email/clients': 'agency',
  '/email/contacts': 'contacts',
  '/email/consent': 'consent',
  '/email/suppression': 'suppress',
  '/email/governance': 'govern',
  '/email/segments': 'segment',
  '/email/templates': 'template',
  '/email/campaigns': 'campaign',
  '/email/journeys': 'journey',
  '/email/deliverability': 'deliver',
  '/email/reports': 'seoChart',
  '/email/gate-a': 'seoGate',
  '/crm/automation': 'workflow',
  '/crm/playbooks': 'playbook',
  '/crm/gtm/demos': 'inbox',
  '/crm/gtm/cms': 'seoPublish',
  '/admin/ai/agents': 'agent',
  '/admin/ai/runs': 'run',
  '/admin/ai/tools': 'tool',
  '/admin/video/providers': 'run',
  '/admin/crm/custom-fields': 'fields',
  '/admin/crm/pipeline': 'pipeline',
};

/** One icon per sidebar section (module rail when collapsed). */
export const SECTION_ICONS: Record<string, string> = {
  'Tổng quan': 'home',
  'CSKH vận hành': 'sla',
  'B2B Sales': 'sales',
  'Lead chung': 'leads',
  'Lead & CSKH': 'leads',
  'Bán hàng': 'sales',
  'Lên kế hoạch': 'search',
  'Triển khai DV': 'lifecycle',
  'Nhân sự & KPI': 'staff',
  'Quản trị': 'finance',
  'Hệ thống': 'settings',
  Agency: 'agency',
  'Quảng cáo': 'megaphone',
  SEO: 'seo',
  Email: 'email',
  AI: 'agent',
  'Cấu hình': 'settings',
  GTM: 'inbox',
};

/** Shorter labels for sidebar headers. */
export const SECTION_LABELS: Record<string, string> = {
  'Tổng quan': 'Tổng quan',
  'CRM · CSKH vận hành': 'CSKH vận hành',
  'CRM · B2B Sales': 'B2B Sales',
  'CRM · Lead chung': 'Lead chung',
  'CRM · Lead & CSKH': 'Lead & CSKH',
  'CRM · Bán hàng & Hợp đồng': 'Bán hàng',
  'Lên kế hoạch': 'Lên kế hoạch',
  'CRM · Triển khai dịch vụ': 'Triển khai DV',
  'CRM · Nhân sự & KPI': 'Nhân sự & KPI',
  'Quản trị & Tài chính': 'Quản trị',
  'Agency & Client': 'Agency',
  'Kênh quảng cáo': 'Quảng cáo',
  'SEO / AEO': 'SEO',
  'Email Marketing': 'Email',
  'AI & Automation': 'AI',
  'Quản trị hệ thống': 'Hệ thống',
  'Cấu hình CRM': 'Cấu hình',
  GTM: 'inbox',
};

export function sectionShortLabel(fullLabel: string): string {
  return SECTION_LABELS[fullLabel] ?? fullLabel;
}

export function sectionIcon(fullLabel: string): string {
  const short = sectionShortLabel(fullLabel);
  return SECTION_ICONS[short] ?? 'dot';
}
