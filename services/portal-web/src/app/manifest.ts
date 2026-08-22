import type { MetadataRoute } from 'next';

/**
 * RNOS-M2 — Portal PWA manifest (client approver mobile).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PTT Client Portal',
    short_name: 'PTT Portal',
    description: 'Duyệt creative, email và xem KPI client',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ecefea',
    theme_color: '#17692f',
    lang: 'vi',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
