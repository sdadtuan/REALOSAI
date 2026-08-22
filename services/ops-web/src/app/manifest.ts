import type { MetadataRoute } from 'next';

/**
 * RNOS-41 / WIN-1 — PWA manifest (mobile lead care).
 * Served at /manifest.webmanifest
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PTT Revenue OS',
    short_name: 'PTT CRM',
    description: 'CSKH lead care — PTT agency staff console',
    start_url: '/crm/leads',
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
