'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AgencyHubPageShell } from '@/components/agency/AgencyHubPageShell';
import {
  fetchAgencyNotifications,
  markAgencyNotificationRead,
  markAllAgencyNotificationsRead,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import type { NotificationRow } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

const RECIPIENT = 'ops';

export default function AgencyNotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_agency', 'view')) return null;
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      return out.access_token;
    }
  }, [router]);

  const reload = useCallback(async (access: string) => {
    const data = await fetchAgencyNotifications(access);
    setItems(data.notifications);
    setUnread(data.unread);
  }, []);

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        await reload(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải thông báo thất bại');
      }
    })();
  }, [ensureAuth, reload]);

  const filtered = filter ? items.filter((n) => n.category === filter) : items;

  async function markRead(id: string) {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    try {
      await markAgencyNotificationRead(access, id, RECIPIENT);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đánh dấu đã đọc thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function markAll() {
    const access = getAccessToken();
    if (!access) return;
    setBusy(true);
    try {
      await markAllAgencyNotificationsRead(access, RECIPIENT);
      await reload(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đánh dấu tất cả thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <AgencyHubPageShell
        user={null}
        onLogout={logout}
        title="Thông báo"
        agencyUnread={unread}
        loading
      >
        <span />
      </AgencyHubPageShell>
    );
  }

  return (
    <AgencyHubPageShell
      user={user}
      onLogout={logout}
      title="Thông báo"
      subtitle={unread > 0 ? `${unread} chưa đọc` : undefined}
      agencyUnread={unread}
      actions={
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={busy || unread === 0}
          onClick={() => void markAll()}
        >
          Đánh dấu tất cả đã đọc
        </button>
      }
    >
      <div className="page-card stack-gap">
        <div className="agency-tabs">
          {['', 'sla', 'ingest', 'system'].map((cat) => (
            <button
              key={cat || 'all'}
              type="button"
              className={`agency-tab${filter === cat ? ' is-active' : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat === '' ? 'Tất cả' : cat.toUpperCase()}
            </button>
          ))}
        </div>

        {error ? <p className="error">{error}</p> : null}

        <ul className="notification-list">
          {filtered.map((n) => (
            <li key={n.id} className={`notif-item${n.read ? '' : ' notif-item--unread'}`}>
              <div style={{ flex: '1 1 auto' }}>
                {n.link_url ? (
                  <Link href={n.link_url} className="nav-link">
                    <strong>{n.title}</strong>
                  </Link>
                ) : (
                  <strong>{n.title}</strong>
                )}
                {n.body ? <p className="muted" style={{ margin: '0.25rem 0 0' }}>{n.body}</p> : null}
                <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                  {n.category} · {n.created_at?.slice(0, 16) ?? '—'}
                  {n.link_url ? (
                    <>
                      {' · '}
                      <Link href={n.link_url} className="nav-link">
                        Mở liên kết
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                {n.link_url ? (
                  <Link href={n.link_url} className="btn btn-secondary btn-sm">
                    Xem
                  </Link>
                ) : null}
                {!n.read ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => void markRead(n.id)}
                  >
                    Đã đọc
                  </button>
                ) : null}
              </div>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="agency-empty muted">Không có thông báo</li>
          ) : null}
        </ul>
      </div>
    </AgencyHubPageShell>
  );
}
