'use client';

import { FormEvent, useState } from 'react';
import { portalChangePassword } from '@/lib/api';
import { SettingsSection } from './SettingsSection';

type ChangePasswordFormProps = {
  token: string;
  email: string;
};

export function ChangePasswordForm({ token, email }: ChangePasswordFormProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (next.length < 8) {
      setError('Mật khẩu mới tối thiểu 8 ký tự.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await portalChangePassword(token, current, next);
      setMessage('Đã đổi mật khẩu. Lần đăng nhập sau dùng mật khẩu mới.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsSection title="Đổi mật khẩu" description={`Tài khoản: ${email}`}>
      <form className="settings-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="current_pw">Mật khẩu hiện tại</label>
          <input
            id="current_pw"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="new_pw">Mật khẩu mới</label>
          <input
            id="new_pw"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="field">
          <label htmlFor="confirm_pw">Xác nhận mật khẩu mới</label>
          <input
            id="confirm_pw"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="settings-form__success">{message}</p> : null}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Đổi mật khẩu'}
        </button>
      </form>
    </SettingsSection>
  );
}
