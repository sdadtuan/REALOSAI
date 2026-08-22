'use client';

import { useEffect } from 'react';
import { isCapacitorNative } from '@/lib/capacitor';
import { navigatePortalDeepLink } from '@/lib/capacitorDeepLink';

const CLIENT_VERSION = '1.0';
const APP_VERSION = '0.1.0';

function ensureCapacitorBridge(): void {
  if (!isCapacitorNative()) return;
  if (window.__PTT_CAPACITOR__?.native) return;
  const cap = window.Capacitor;
  window.__PTT_CAPACITOR__ = {
    native: true,
    platform: cap?.getPlatform?.() ?? 'unknown',
    version: CLIENT_VERSION,
    appVersion: APP_VERSION,
  };
  document.documentElement.dataset.pttCapacitor = window.__PTT_CAPACITOR__.platform;
}

function patchFetchClientHeaders(): void {
  if (!isCapacitorNative() || window.__PTT_FETCH_PATCHED__) return;
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

async function initNativeChrome(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0f172a' });
  } catch {
    /* non-fatal */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* non-fatal */
  }
}

async function bindDeepLinks(): Promise<void> {
  if (!isCapacitorNative()) return;
  const { App } = await import('@capacitor/app');

  await App.addListener('appUrlOpen', (event) => {
    navigatePortalDeepLink(event.url);
  });

  const launch = await App.getLaunchUrl();
  if (launch?.url) {
    navigatePortalDeepLink(launch.url);
  }
}

/**
 * RNOS-M3 Phase 1 — Capacitor shell init inside remote Portal WebView.
 */
export function CapacitorShellInit() {
  useEffect(() => {
    if (!isCapacitorNative()) return;
    ensureCapacitorBridge();
    patchFetchClientHeaders();
    void initNativeChrome();
    void bindDeepLinks();
  }, []);

  return null;
}

declare global {
  interface Window {
    __PTT_FETCH_PATCHED__?: boolean;
  }
}
