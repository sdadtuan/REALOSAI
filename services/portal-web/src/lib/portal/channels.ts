import type { PerformanceChannel } from '@/lib/api';

export type PortalChannelConfig = {
  id: PerformanceChannel;
  href: string;
  label: string;
  breadcrumb: string;
  title: string;
  subtitle: string;
  hint: string;
};

export const PORTAL_CHANNELS: Record<PerformanceChannel, PortalChannelConfig> = {
  meta: {
    id: 'meta',
    href: '/meta',
    label: 'Meta',
    breadcrumb: 'Meta Performance',
    title: 'Meta Performance',
    subtitle: 'Facebook & Instagram — CPL, spend và leads CRM',
    hint: 'Facebook / Instagram',
  },
  google: {
    id: 'google',
    href: '/google',
    label: 'Google Ads',
    breadcrumb: 'Google Performance',
    title: 'Google Ads Performance',
    subtitle: 'Search & Display — CPL, spend và leads CRM',
    hint: 'Search & Display',
  },
  zalo: {
    id: 'zalo',
    href: '/zalo',
    label: 'Zalo Ads',
    breadcrumb: 'Zalo Performance',
    title: 'Zalo Ads Performance',
    subtitle: 'Zalo ecosystem — CPL, spend và leads CRM',
    hint: 'Zalo ecosystem',
  },
};

export const PORTAL_CHANNEL_LIST: PortalChannelConfig[] = [
  PORTAL_CHANNELS.meta,
  PORTAL_CHANNELS.google,
  PORTAL_CHANNELS.zalo,
];

export function portalChannelConfig(channel: PerformanceChannel): PortalChannelConfig {
  return PORTAL_CHANNELS[channel];
}
