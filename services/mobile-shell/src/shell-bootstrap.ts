/**
 * RNOS-M3 — Capacitor shell bootstrap (bundled to www/shell-bootstrap.js).
 * Used when webDir loads locally; remote server.url relies on portal-web useCapacitorShell.
 */
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { navigatePortalDeepLink } from './deep-link';

const CLIENT_VERSION = '1.0';
const APP_VERSION = '0.1.0';

function installCapacitorBridge(): void {
  if (!Capacitor.isNativePlatform()) return;
  window.__PTT_CAPACITOR__ = {
    native: true,
    platform: Capacitor.getPlatform(),
    version: CLIENT_VERSION,
    appVersion: APP_VERSION,
  };
  document.documentElement.dataset.pttCapacitor = Capacitor.getPlatform();
}

function installFetchClientHeader(): void {
  if (!Capacitor.isNativePlatform() || window.__PTT_FETCH_PATCHED__) return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers ?? {});
    if (!headers.has('X-PTT-Client')) {
      headers.set('X-PTT-Client', `capacitor-portal/${CLIENT_VERSION}`);
    }
    if (!headers.has('X-PTT-App-Version')) {
      headers.set('X-PTT-App-Version', APP_VERSION);
    }
    return original(input, { ...init, headers });
  };
  window.__PTT_FETCH_PATCHED__ = true;
}

async function initChrome(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {
    /* non-fatal */
  }
  try {
    await SplashScreen.hide();
  } catch {
    /* non-fatal */
  }
}

async function bindDeepLinks(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await App.addListener('appUrlOpen', (event) => {
    navigatePortalDeepLink(event.url);
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) {
    navigatePortalDeepLink(launch.url);
  }
}

export async function bootstrapMobileShell(): Promise<void> {
  installCapacitorBridge();
  installFetchClientHeader();
  await initChrome();
  await bindDeepLinks();
}

void bootstrapMobileShell();

declare global {
  interface Window {
    __PTT_CAPACITOR__?: {
      native: boolean;
      platform: string;
      version: string;
      appVersion: string;
    };
    __PTT_FETCH_PATCHED__?: boolean;
  }
}
