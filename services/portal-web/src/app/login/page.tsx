'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalAuthShell } from '@/components/layout';
import { isTenantArchivedError, portalLogin } from '@/lib/api';
import { saveSession } from '@/lib/auth';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resetOk = searchParams.get('reset') === 'ok';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const out = await portalLogin(email.trim(), password);
      saveSession(out.access_token, out.user, {
        refreshToken: out.refresh_token,
        expiresInSec: out.expires_in,
      });
      router.push('/dashboard');
    } catch (err) {
      if (isTenantArchivedError(err)) {
        router.replace('/archived');
        return;
      }
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalAuthShell
      badge="Client Portal"
      title="Đăng nhập"
      subtitle="Xem CPL / spend và duyệt creative cho chiến dịch của bạn"
      footer={
        <>
          <p className="portal-auth-shell__link-row">
            <Link href="/forgot-password">Quên mật khẩu?</Link>
          </p>
          <p className="muted portal-auth-shell__link-row">
            <Link href="/privacy">Chính sách quyền riêng tư</Link>
          </p>
          <p className="muted portal-auth-shell__dev-hint">
            Dev: <code>approver@demo.local</code> / <code>demo123</code>
          </p>
        </>
      }
    >
      {resetOk ? (
        <p className="portal-auth-shell__success">Mật khẩu đã được cập nhật — đăng nhập bằng mật khẩu mới.</p>
      ) : null}
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Mật khẩu</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn portal-auth-shell__submit" type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
      </form>
    </PortalAuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="portal-auth-shell">
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
