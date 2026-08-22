import type { CapacitorConfig } from '@capacitor/cli';

const portalUrl = process.env.CAPACITOR_PORTAL_URL ?? 'https://portal.pttads.vn';
const universalLinkHost = process.env.PTT_PORTAL_UNIVERSAL_LINK_HOST ?? 'portal.pttads.vn';

/**
 * RNOS-M3 Phase 1 — Capacitor shell loads Portal PWA remotely.
 * Staging: CAPACITOR_PORTAL_URL=https://portal-staging.pttads.vn npm run cap:sync
 */
const config: CapacitorConfig = {
  appId: 'vn.pttads.portal',
  appName: 'PTT Portal',
  webDir: 'www',
  server: {
    url: portalUrl,
    cleartext: false,
    androidScheme: 'https',
    hostname: universalLinkHost,
  },
  ios: {
    scheme: 'pttads',
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#0f172a',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f172a',
    },
    App: {},
  },
};

export default config;
