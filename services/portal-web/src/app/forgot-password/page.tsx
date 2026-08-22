'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { PortalAuthShell } from '@/components/layout';
import { portalForgotPassword } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setDevResetUrl('');
    setLoading(true);
    try {
      const out = await portalForgotPassword(email.trim());
      setMessage(out.message);
      if (out.reset_url) {
        try {
          const u = new URL(out.reset_url);
          setDevResetUrl(`${u.pathname}${u.search}`);
        } catch {
          setDevResetUrl(out.reset_url);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi yêu cầu thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PortalAuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email portal — nếu tài khoản tồn tại, bạn sẽ nhận link đặt lại mật khẩu."
      footer={
        <p className="portal-auth-shell__link-row">
          <Link href="/login">← Quay lại đăng nhập</Link>
        </p>
      }
    >
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
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        {devResetUrl ? (
          <p className="muted portal-auth-shell__dev-hint">
            Dev/staging link: <Link href={devResetUrl}>Mở trang đặt lại mật khẩu</Link>
          </p>
        ) : null}
        <button className="btn portal-auth-shell__submit" type="submit" disabled={loading}>
          {loading ? 'Đang gửi…' : 'Gửi link đặt lại'}
        </button>
      </form>
    </PortalAuthShell>
  );
}
