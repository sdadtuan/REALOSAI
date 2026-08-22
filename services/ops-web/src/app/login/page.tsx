'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeycloakRedirect } from '@/components/login/KeycloakRedirect';
import { WinSsoMigrationBanner } from '@/components/rbac/WinSsoMigrationBanner';
import { fetchStaffSsoConfig, sandboxLogin, staffLogin, staffMe } from '@/lib/api';
import { saveSession, updateStoredUser } from '@/lib/auth';
import { winSsoEnabled } from '@/lib/win/flags';

function LoginPageContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoMode, setSsoMode] = useState<'nest' | 'keycloak' | 'dual'>('nest');
  const [nestAllowed, setNestAllowed] = useState(true);

  useEffect(() => {
    if (!winSsoEnabled()) return;
    void fetchStaffSsoConfig()
      .then((cfg) => {
        setSsoMode(cfg.mode);
        setNestAllowed(cfg.nest_login_allowed);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loginId = email.trim();
      const out = loginId.startsWith('demo_')
        ? await sandboxLogin(loginId, password)
        : await staffLogin(loginId, password);
      saveSession(out.access_token, out.refresh_token, out.user);
      if (out.user.position_code === 'sandbox_visitor') {
        router.push('/sandbox/leads');
        return;
      }
      const me = await staffMe(out.access_token);
      updateStoredUser(me);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') ? next : '/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  const showSso = winSsoEnabled() && ssoMode !== 'nest';
  const showPassword = !winSsoEnabled() || ssoMode === 'nest' || (ssoMode === 'dual' && nestAllowed);

  return (
    <main className="login-page">
      <div className="card login-card">
        <p className="badge" style={{ marginBottom: '0.75rem' }}>
          PTT CRM
        </p>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem' }}>Đăng nhập nhân viên</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
          Staff console — rs.pttads.vn
        </p>
        {showSso ? <WinSsoMigrationBanner /> : null}
        {showSso ? <KeycloakRedirect /> : null}
        {showSso && showPassword ? (
          <p className="muted" style={{ textAlign: 'center', margin: '0.75rem 0', fontSize: '0.85rem' }}>
            hoặc mật khẩu Nest (dual-auth)
          </p>
        ) : null}
        {showPassword ? (
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
            <button className="btn" type="submit" disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>
          </form>
        ) : null}
        {!showPassword && !showSso ? (
          <p className="error">Không có phương thức đăng nhập — kiểm tra STAFF_AUTH_MODE.</p>
        ) : null}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="login-page">
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
