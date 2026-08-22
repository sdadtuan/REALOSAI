'use client';

import Link from 'next/link';
import { KeycloakRedirect } from '@/components/login/KeycloakRedirect';
import { WinSsoMigrationBanner } from '@/components/rbac/WinSsoMigrationBanner';

export default function StaffMfaLoginPage() {
  return (
    <main className="login-page">
      <div className="card login-card">
        <p className="badge" style={{ marginBottom: '0.75rem' }}>
          MFA bắt buộc
        </p>
        <h1 style={{ margin: '0 0 0.35rem', fontSize: '1.5rem' }}>Xác thực OTP</h1>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1.25rem' }}>
          Chức vụ GDKD / Super-admin cần bước OTP trên Keycloak trước khi vào CRM.
        </p>
        <WinSsoMigrationBanner />
        <KeycloakRedirect mfaStep label="Tiếp tục với OTP" />
        <p className="muted" style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
          <Link href="/login">← Quay lại đăng nhập</Link>
        </p>
      </div>
    </main>
  );
}
