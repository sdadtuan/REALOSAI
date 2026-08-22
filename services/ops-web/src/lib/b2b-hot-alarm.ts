import { API_BASE } from './api';

export function shouldRingHotAlarm(input: {
  severity: string;
  inHours: boolean;
  leadOpen: boolean;
  elapsedMs: number;
}): boolean {
  if (input.leadOpen || !input.inHours) return false;
  if (input.severity !== 'urgent') return false;
  return input.elapsedMs < 30_000;
}

export function isB2bHotSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem('b2bHotSound') !== '0';
}

export function isB2bSalesInHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === 'weekday')?.value;
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const day = map[wd ?? ''] ?? -1;
  if (![1, 2, 3, 4, 5, 6].includes(day)) return false;
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  const cur = `${hour}:${minute}`;
  return cur >= '08:00' && cur < '18:00';
}

export function alertSeverityLabel(severity: string, kind: string): string {
  if (severity === 'urgent' || kind === 'assigned_hot') return 'Hot';
  if (kind === 'unassigned') return 'Chờ nhận';
  if (severity === 'inbox') return 'Inbox';
  return 'Thường';
}

export function b2bSlaStateLabel(state: string | null | undefined): string {
  if (state === 'breach') return 'Breach';
  if (state === 'warning') return 'Cảnh báo';
  if (state === 'ok') return 'OK';
  return '—';
}

export function b2bAiBandLabel(band: string | null | undefined): string {
  if (band === 'hot') return 'Hot';
  if (band === 'warm') return 'Warm';
  if (band === 'cold') return 'Cold';
  return '—';
}

export async function registerB2bStaffPush(token: string): Promise<void> {
  if (typeof window === 'undefined' || !isB2bHotSoundEnabled()) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  const vapidRes = await fetch(`${API_BASE}/api/v1/b2b-staff-push/vapid`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!vapidRes?.ok) return;
  const vapid = (await vapidRes.json()) as { enabled?: boolean; publicKey?: string | null };
  if (!vapid.enabled || !vapid.publicKey) return;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const key = vapid.publicKey.replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(key);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: bytes,
    });
  }
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

  await fetch(`${API_BASE}/api/v1/b2b-staff-push/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    }),
  }).catch(() => undefined);
}
