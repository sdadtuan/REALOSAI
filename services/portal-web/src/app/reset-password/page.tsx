'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PortalAuthShell } from '@/components/layout';
import { portalResetPassword, portalValidateResetToken } from '@/lib/api';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [emailMasked, setEmailMasked] = useState('');
  const [validating, setValidating] = useState(true);
  const [tokenOk, setTokenOk] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setValidating(false);
      setTokenOk(false);
      setError('Link không hợp lệ — thiếu token.');
      return;
    }
    void portalValidateResetToken(token)
      .then((out) => {
        if (out.ok) {
          setTokenOk(true);
          setEmailMasked(out.email_masked ?? '');
        } else {
          setError('Link hết hạn hoặc đã được sử dụng. Yêu cầu link mới.');
        }
      })
      .catch(() => setError('Không xác thực được link.'))
      .finally(() => setValidating(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu tối thiểu 8 ký tự.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await portalResetPassword(token, password);
      router.replace('/login?reset=ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalAuthShell
      title="Đặt mật khẩu mới"
      footer={
        <p className="portal-auth-shell__link-row">
          <Link href="/login">← Đăng nhập</Link>
        </p>
      }
    >
      {validating ? <p className="muted">Đang kiểm tra link…</p> : null}
      {!validating && tokenOk ? (
        <>
          {emailMasked ? <p className="muted">Tài khoản: {emailMasked}</p> : null}
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="password">Mật khẩu mới</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm">Xác nhận mật khẩu</label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            {error ? <p className="error">{error}</p> : null}
            <button className="btn portal-auth-shell__submit" type="submit" disabled={loading}>
              {loading ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
            </button>
          </form>
        </>
      ) : null}
      {!validating && !tokenOk ? (
        <>
          {error ? <p className="error">{error}</p> : null}
          <p className="portal-auth-shell__link-row">
            <Link href="/forgot-password">Yêu cầu link mới</Link>
          </p>
        </>
      ) : null}
    </PortalAuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="portal-auth-shell">
          <p className="muted">Đang tải…</p>
        </main>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  );
}
