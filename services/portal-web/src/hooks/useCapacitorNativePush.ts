'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchMobileConfig,
  registerNativeDeviceToken,
  testNativePush,
  unregisterNativeDeviceToken,
} from '@/lib/api';
import { isCapacitorNative } from '@/lib/capacitor';
import { navigatePortalDeepLink } from '@/lib/capacitorDeepLink';

const APP_VERSION = '0.1.0';

export function useCapacitorNativePush(token: string | null) {
  const [native, setNative] = useState(false);
  const [platform, setPlatform] = useState('unknown');
  const [registered, setRegistered] = useState(false);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isCapacitorNative()) return;
    setNative(true);
    setPlatform(window.__PTT_CAPACITOR__?.platform ?? 'unknown');
    void fetchMobileConfig(APP_VERSION)
      .then((cfg) => {
        setPushEnabled(cfg.native_push_enabled);
        setForceUpdate(cfg.force_update);
      })
      .catch(() => setPushEnabled(null));
  }, []);

  const enableNativePush = useCallback(async () => {
    if (!token || !native) return;
    setBusy(true);
    setError('');
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') {
        setError('Quyền thông báo native bị từ chối.');
        return;
      }

      const tokenResult = await new Promise<string>(async (resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('device_token_timeout')), 15000);
        const onDone = () => window.clearTimeout(timeout);
        const regListener = await PushNotifications.addListener('registration', (ev) => {
          onDone();
          void regListener.remove();
          void errListener.remove();
          resolve(ev.value);
        });
        const errListener = await PushNotifications.addListener('registrationError', (ev) => {
          onDone();
          void regListener.remove();
          void errListener.remove();
          reject(new Error(ev.error));
        });
        try {
          await PushNotifications.register();
        } catch (err) {
          onDone();
          void regListener.remove();
          void errListener.remove();
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      });

      await registerNativeDeviceToken(token, {
        token: tokenResult,
        platform,
        app_version: APP_VERSION,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });

      setDeviceToken(tokenResult);
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không bật được native push');
      setRegistered(false);
    } finally {
      setBusy(false);
    }
  }, [native, platform, token]);

  const disableNativePush = useCallback(async () => {
    if (!token || !deviceToken) return;
    setBusy(true);
    setError('');
    try {
      await unregisterNativeDeviceToken(token, deviceToken);
      const { PushNotifications } = await import('@capacitor/push-notifications');
      await PushNotifications.removeAllListeners();
      setRegistered(false);
      setDeviceToken(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tắt được native push');
    } finally {
      setBusy(false);
    }
  }, [deviceToken, token]);

  const sendTestPush = useCallback(async () => {
    if (!token) return '';
    const out = await testNativePush(token);
    return out.message ?? (out.ok ? 'Test native push OK' : 'Test native push failed');
  }, [token]);

  useEffect(() => {
    if (!native || !token) return;
    let cancelled = false;

    void (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification.data ?? {};
          const creativeId = data.creative_id ?? data.creativeId;
          if (typeof creativeId === 'string' && creativeId) {
            navigatePortalDeepLink(`pttads://approve/${creativeId}`);
            return;
          }
          const url =
            (data.url as string | undefined) ?? (data.link as string | undefined);
          if (url) {
            navigatePortalDeepLink(url.startsWith('pttads://') || url.startsWith('http') ? url : `/${url.replace(/^\//, '')}`);
          }
        });
        if (cancelled) return;
      } catch {
        /* plugin unavailable outside native shell */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [native, token]);

  return {
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
  };
}
