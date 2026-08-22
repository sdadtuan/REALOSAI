import type { Metadata, Viewport } from 'next';
import './globals.css';
import './bitrix-theme.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'PTT Ops',
  description: 'Internal operations console for PTT agency staff',
  applicationName: 'PTT Revenue OS',
  appleWebApp: {
    capable: true,
    title: 'PTT CRM',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#17692f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="ops-shell-collapsed ops-shell-bitrix">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
