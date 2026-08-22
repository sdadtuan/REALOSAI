/**
 * Resolve Capacitor deep links → portal-web routes (mirror mobile-shell/src/deep-link.ts).
 */
export function resolvePortalDeepLink(raw: string): string | null {
  const input = (raw ?? '').trim();
  if (!input) return null;

  try {
    const url = input.includes('://') ? new URL(input) : new URL(input, 'pttads://local');

    const scheme = url.protocol.replace(':', '').toLowerCase();
    if (scheme === 'pttads' || scheme === 'local') {
      return resolvePttadsPath(url.hostname, url.pathname, url.searchParams);
    }

    if (scheme === 'https' || scheme === 'http') {
      const path = `${url.pathname}${url.search}`;
      if (path && path !== '/') return path.startsWith('/') ? path : `/${path}`;
    }
  } catch {
    return null;
  }

  return null;
}

function resolvePttadsPath(host: string, pathname: string, params: URLSearchParams): string | null {
  const segment = (host && host !== 'local' ? host : pathname.replace(/^\//, '')).toLowerCase();
  const rest = pathname.replace(/^\//, '').split('/').filter(Boolean);

  if (segment === 'approve' || rest[0] === 'approve') {
    const creativeId = rest[0] === 'approve' ? rest[1] : rest[0] === undefined && host !== 'local' ? host : rest[0];
    if (creativeId && creativeId !== 'approve') {
      return `/creatives?focus=${encodeURIComponent(creativeId)}`;
    }
    return '/creatives';
  }

  if (segment === 'creatives' || rest[0] === 'creatives') {
    const id = params.get('focus') ?? params.get('id') ?? rest[1];
    return id ? `/creatives?focus=${encodeURIComponent(id)}` : '/creatives';
  }

  if (segment === 'notifications') return '/notifications';
  if (segment === 'email' && (rest[0] === 'approvals' || rest[1] === 'approvals')) return '/email/approvals';
  if (segment === 'dashboard') return '/dashboard';
  if (segment === 'settings') return '/settings';

  if (pathname && pathname !== '/') {
    return pathname.startsWith('/') ? pathname : `/${pathname}`;
  }

  return null;
}

export function navigatePortalDeepLink(raw: string): boolean {
  if (typeof window === 'undefined') return false;
  const target = resolvePortalDeepLink(raw);
  if (!target) return false;
  if (window.location.pathname + window.location.search === target) return true;
  window.location.href = target;
  return true;
}
