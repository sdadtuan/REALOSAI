/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/((?!_next/static|icons|sw\\.js|manifest\\.webmanifest).*)',
        headers: [{ key: 'Cache-Control', value: 'no-store, must-revalidate' }],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/crm/agency', destination: '/agency', permanent: false },
      { source: '/crm/agency/:path*', destination: '/agency/:path*', permanent: false },
    ];
  },
};

export default nextConfig;
