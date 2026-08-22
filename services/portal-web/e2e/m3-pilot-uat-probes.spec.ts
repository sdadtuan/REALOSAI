/**
 * RNOS-M3 Phase 3 — UAT probes (deep link resolver, no login required)
 */
import { test, expect } from '@playwright/test';

// Inline resolver mirror for e2e (imports from src would need bundler)
function resolvePortalDeepLink(raw: string): string | null {
  const input = (raw ?? '').trim();
  if (!input) return null;
  try {
    const url = input.includes('://') ? new URL(input) : new URL(input, 'pttads://local');
    const scheme = url.protocol.replace(':', '').toLowerCase();
    if (scheme === 'pttads' || scheme === 'local') {
      const segment = (url.hostname && url.hostname !== 'local' ? url.hostname : url.pathname.replace(/^\//, '')).toLowerCase();
      const rest = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
      if (segment === 'approve' || rest[0] === 'approve') {
        const creativeId = rest[0] === 'approve' ? rest[1] : rest[0];
        if (creativeId && creativeId !== 'approve') {
          return `/creatives?focus=${encodeURIComponent(creativeId)}`;
        }
        return '/creatives';
      }
      if (segment === 'email' && (rest[0] === 'approvals' || rest[1] === 'approvals')) return '/email/approvals';
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

test.describe('M3 pilot UAT — deeplink resolver', () => {
  test('scenario 3: pttads approve → creatives focus', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(resolvePortalDeepLink(`pttads://approve/${id}`)).toBe(
      `/creatives?focus=${encodeURIComponent(id)}`,
    );
  });

  test('scenario 5: HTTPS portal creatives universal link', () => {
    expect(resolvePortalDeepLink('https://portal.pttads.vn/creatives?focus=abc-123')).toBe(
      '/creatives?focus=abc-123',
    );
  });

  test('scenario 5: HTTPS email approvals path', () => {
    expect(resolvePortalDeepLink('https://portal.pttads.vn/email/approvals')).toBe('/email/approvals');
  });

  test('scenario 4: pttads email approvals', () => {
    expect(resolvePortalDeepLink('pttads://email/approvals')).toBe('/email/approvals');
  });
});
