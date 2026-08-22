'use client';

import { useEffect, useState } from 'react';
import { fetchStaffSsoConfig } from '@/lib/api';
import { buildStaffKeycloakAuthUrl } from '@/lib/auth/keycloak-pkce';

type Props = {
  mfaStep?: boolean;
  label?: string;
  className?: string;
};

export function KeycloakRedirect({ mfaStep = false, label, className }: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function startLogin() {
    setError('');
    setLoading(true);
    try {
      const cfg = await fetchStaffSsoConfig();
      if (!cfg.issuer) {
        setError('SSO chưa cấu hình (PTT_STAFF_KEYCLOAK_ISSUER)');
        return;
      }
      const redirectUri = `${window.location.origin}/login/callback`;
      const url = await buildStaffKeycloakAuthUrl({
        issuer: cfg.issuer,
        clientId: cfg.client_id,
        redirectUri,
        ...(mfaStep ? { acrValues: 'mfa', prompt: 'login' } : {}),
      });
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không mở được Keycloak');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mfaStep) {
      void startLogin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfaStep]);

  if (mfaStep) {
    return (
      <p className="muted" style={{ marginTop: '1rem' }}>
        {loading ? 'Đang chuyển sang xác thực OTP…' : error || 'Chuẩn bị MFA…'}
      </p>
    );
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button
        type="button"
        className={className ?? 'btn btn-secondary'}
        style={{ width: '100%' }}
        disabled={loading}
        onClick={() => void startLogin()}
      >
        {loading ? 'Đang mở SSO…' : label ?? 'Đăng nhập SSO (Keycloak)'}
      </button>
      {error ? <p className="error">{error}</p> : null}
    </div>
  );
}
