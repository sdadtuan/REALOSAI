'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { staffMe, staffOidcExchange, ApiError } from '@/lib/api';
import { saveSession, updateStoredUser } from '@/lib/auth';
import { clearPkceSession, readPkceState, readPkceVerifier } from '@/lib/auth/keycloak-pkce';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    void (async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const verifier = readPkceVerifier();
      const expectedState = readPkceState();

      if (!code || !verifier) {
        setError('Thiếu mã OIDC — thử đăng nhập lại.');
        return;
      }
      if (expectedState && state !== expectedState) {
        setError('State OIDC không khớp.');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/login/callback`;
        const out = await staffOidcExchange({
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
        });
        clearPkceSession();
        saveSession(out.access_token, out.refresh_token, out.user);
        const me = await staffMe(out.access_token);
        updateStoredUser(me);
        const next = new URLSearchParams(window.location.search).get('next');
        router.replace(next && next.startsWith('/') ? next : '/');
      } catch (err) {
        clearPkceSession();
        if (err instanceof ApiError && err.status === 403 && err.message === 'mfa_required') {
          router.replace('/login/mfa');
          return;
        }
        setError(err instanceof Error ? err.message : 'OIDC exchange thất bại');
      }
    })();
  }, [router, searchParams]);

  return (
    <main className="login-page">
      <div className="card login-card">
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Đang hoàn tất SSO…</h1>
        {error ? <p className="error">{error}</p> : <p className="muted">Vui lòng đợi.</p>}
      </div>
    </main>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
