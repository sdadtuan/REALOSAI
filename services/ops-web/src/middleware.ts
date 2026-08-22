import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AUTH_COOKIE, POSITION_COOKIE } from '@/lib/auth';
import { isSandboxAllowedPath } from '@/lib/sandbox/caps';
import { isStaffAuthPath } from '@/lib/rbac-routes';

const PUBLIC_PATHS = ['/login', '/403'];

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/icons') ||
    pathname === '/favicon.ico' ||
    pathname === '/sw.js' ||
    pathname === '/manifest.webmanifest'
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const authed = request.cookies.get(AUTH_COOKIE)?.value === '1';
  const positionCode = request.cookies.get(POSITION_COOKIE)?.value ?? '';

  if (pathname.startsWith('/sandbox')) {
    if (!authed) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (authed && positionCode === 'sandbox_visitor') {
    if (pathname.startsWith('/api')) {
      return NextResponse.next();
    }
    if (isSandboxAllowedPath(pathname)) {
      return NextResponse.next();
    }
    const blockUrl = request.nextUrl.clone();
    blockUrl.pathname = '/sandbox/not-in-sandbox';
    blockUrl.search = '';
    return NextResponse.redirect(blockUrl);
  }

  if (!isStaffAuthPath(pathname)) {
    return NextResponse.next();
  }

  if (!authed) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
