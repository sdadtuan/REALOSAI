'use client';

import { useEffect } from 'react';
import { getAccessToken, syncAuthCookie } from '@/lib/auth';

/** Keeps middleware auth cookie in sync with sessionStorage (existing sessions after deploy). */
export function AuthCookieSync() {
  useEffect(() => {
    if (getAccessToken()) syncAuthCookie();
  }, []);
  return null;
}
