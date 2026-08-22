'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchPortalPushVapidPublicKey,
  subscribePortalPush,
  unsubscribePortalPush,
} from '@/lib/api';

function pushFeatureEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_PWA_ENABLED === '0') return false;
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function usePortalPush(token: string | null) {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [endpoint, setEndpoint] = useState<string | null>(null);

  useEffect(() => {
    if (!pushFeatureEnabled()) return;
    setSupported(true);
    setPermission(Notification.permission);
  }, []);

  const enablePush = useCallback(async () => {
    if (!token || !pushFeatureEnabled()) return;
    setBusy(true);
    setError('');
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setError('Quyền thông báo bị từ chối.');
        return;
      }

      const vapid = await fetchPortalPushVapidPublicKey();
      if (!vapid.enabled || !vapid.public_key) {
        setError('Push chưa bật trên server (VAPID key).');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid.public_key) as BufferSource,
        });
      }

      const json = sub.toJSON();
      await subscribePortalPush(token, json);
      setSubscribed(true);
      setEndpoint(json.endpoint ?? sub.endpoint);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không bật được push');
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [token]);

  const disablePush = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await unsubscribePortalPush(token, ep);
      }
      setSubscribed(false);
      setEndpoint(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tắt được push');
    } finally {
      setBusy(false);
    }
  }, [token]);

  return {
    supported,
    permission,
    subscribed,
    busy,
    error,
    endpoint,
    enablePush,
    disablePush,
  };
}
