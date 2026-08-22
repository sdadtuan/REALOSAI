'use client';

import { winSsoEnabled } from '@/lib/win/flags';

const CUTOVER = process.env.NEXT_PUBLIC_WIN_SSO_CUTOVER ?? '2026-10-01';

export function WinSsoMigrationBanner() {
  if (!winSsoEnabled()) return null;

  return (
    <div
      className="badge"
      style={{
        marginBottom: '1rem',
        display: 'block',
        padding: '0.65rem 0.85rem',
        background: 'var(--surface-muted, #f4f6f8)',
        borderRadius: 8,
        lineHeight: 1.45,
      }}
    >
      <strong>Chuyển đổi SSO enterprise</strong>
      <br />
      <span className="muted" style={{ fontSize: '0.9rem' }}>
        Dual-auth đang bật — đăng nhập Keycloak khuyến nghị. Mật khẩu Nest sẽ ngừng sau{' '}
        {CUTOVER}. GDKD / Super-admin bắt buộc OTP.
      </span>
    </div>
  );
}
