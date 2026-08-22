'use client';

import { useState } from 'react';
import { testPortalPush } from '@/lib/api';
import { useCapacitorNativePush } from '@/hooks/useCapacitorNativePush';
import { usePortalPush } from '@/hooks/usePortalPush';
import { SettingsSection } from './SettingsSection';

export function CapacitorNativePushCard({ token }: { token: string }) {
  const {
    native,
    platform,
    registered,
    pushEnabled,
    forceUpdate,
    busy,
    error,
    enableNativePush,
    disableNativePush,
    sendTestPush,
  } = useCapacitorNativePush(token);
  const [testMessage, setTestMessage] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  if (!native) return null;

  async function onTestPush() {
    setTestBusy(true);
    setTestMessage('');
    try {
      const msg = await sendTestPush();
      setTestMessage(msg);
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : 'Test native push failed');
    } finally {
      setTestBusy(false);
    }
  }

  return (
    <SettingsSection
      title="Native push (RNOS-M3 Capacitor)"
      description={`App shell ${platform} — FCM/APNs qua device token (tách khỏi Web Push PWA).`}
    >
      {forceUpdate ? (
        <p className="error">Cần cập nhật app lên phiên bản mới trước khi tiếp tục.</p>
      ) : null}
      {pushEnabled === false ? (
        <p className="muted">Native push chưa bật trên server (`PTT_MOBILE_NATIVE_PUSH_ENABLED`).</p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      <div className="settings-actions">
        {registered ? (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disableNativePush()}>
              {busy ? 'Đang tắt…' : 'Tắt native push'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={testBusy || pushEnabled === false}
              onClick={() => void onTestPush()}
            >
              {testBusy ? 'Đang gửi test…' : 'Gửi test native push'}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn"
            disabled={busy || pushEnabled === false || forceUpdate}
            onClick={() => void enableNativePush()}
          >
            {busy ? 'Đang bật…' : 'Bật native push'}
          </button>
        )}
      </div>
      {testMessage ? <p className="muted">{testMessage}</p> : null}
    </SettingsSection>
  );
}

export function PushNotificationCard({ token }: { token: string }) {
  const { supported, permission, subscribed, busy, error, enablePush, disablePush } = usePortalPush(token);
  const [testMessage, setTestMessage] = useState('');
  const [testBusy, setTestBusy] = useState(false);

  async function onTestPush() {
    setTestBusy(true);
    setTestMessage('');
    try {
      const out = await testPortalPush(token);
      setTestMessage(out.message ?? (out.ok ? 'Test push OK' : 'Test push failed'));
    } catch (err) {
      setTestMessage(err instanceof Error ? err.message : 'Test push failed');
    } finally {
      setTestBusy(false);
    }
  }

  if (!supported) {
    return (
      <SettingsSection title="Thông báo đẩy (RNOS-M2)">
        <p className="muted">Trình duyệt không hỗ trợ Web Push hoặc PWA chưa bật.</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title="Thông báo đẩy (RNOS-M2)"
      description="Nhận alert creative/email cần duyệt khi Portal chạy nền hoặc đã cài PWA."
    >
      <p className="muted">Quyền hiện tại: {permission}</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="settings-actions">
        {subscribed ? (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void disablePush()}>
              {busy ? 'Đang tắt…' : 'Tắt thông báo đẩy'}
            </button>
            <button type="button" className="btn btn-secondary" disabled={testBusy} onClick={() => void onTestPush()}>
              {testBusy ? 'Đang gửi test…' : 'Gửi test push'}
            </button>
          </>
        ) : (
          <button type="button" className="btn" disabled={busy} onClick={() => void enablePush()}>
            {busy ? 'Đang bật…' : 'Bật thông báo đẩy'}
          </button>
        )}
      </div>
      {testMessage ? <p className="muted">{testMessage}</p> : null}
    </SettingsSection>
  );
}
