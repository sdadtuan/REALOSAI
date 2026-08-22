'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { ToastProvider } from '@/lib/toast';
import { initPortalSentry } from '@/lib/sentry.client';
import { PortalPwaShell } from '@/components/pwa/PortalPwaShell';
import { CapacitorShellInit } from '@/components/capacitor/CapacitorShellInit';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPortalSentry();
  }, []);
  return (
    <ToastProvider>
      <Script src="/capacitor-native-bridge.js" strategy="beforeInteractive" />
      <CapacitorShellInit />
      <PortalPwaShell />
      {children}
    </ToastProvider>
  );
}
