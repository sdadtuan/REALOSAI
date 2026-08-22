'use client';

import { isCapacitorNative } from '@/lib/capacitor';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim();

export type PortalSentryContext = {
  client: 'capacitor-portal' | 'portal-web';
  surface: 'native-webview' | 'browser';
  platform: string;
  app_version?: string;
  shell_version?: string;
};

export function getPortalSentryContext(): PortalSentryContext {
  const native = isCapacitorNative();
  const bridge = typeof window !== 'undefined' ? window.__PTT_CAPACITOR__ : undefined;
  return {
    client: native ? 'capacitor-portal' : 'portal-web',
    surface: native ? 'native-webview' : 'browser',
    platform: native ? (bridge?.platform ?? 'unknown') : 'web',
    app_version: native ? bridge?.appVersion : undefined,
    shell_version: native ? bridge?.version : undefined,
  };
}

export function initPortalSentry(): void {
  if (!DSN || typeof window === 'undefined') {
    return;
  }
  const env = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development';
  const report = (message: string, extra?: Record<string, unknown>) => {
    const ctx = getPortalSentryContext();
    const payload = { ...ctx, ...extra };
    void fetch(`${DSN}`, { method: 'HEAD' }).catch(() => undefined);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[portal-sentry]', env, message, payload);
    }
  };
  window.addEventListener('error', (event) => {
    report(event.message, { stack: event.error?.stack, kind: 'error' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    report(reason, { kind: 'unhandledrejection' });
  });
  report('portal_sentry_init', { kind: 'init' });
}
