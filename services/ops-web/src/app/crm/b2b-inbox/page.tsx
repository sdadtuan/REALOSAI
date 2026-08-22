'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FilterBar, FilterBarActions, HubPageLayout, StaffPageShell } from '@/components/layout';
import {
  alertSeverityLabel,
  isB2bHotSoundEnabled,
} from '@/lib/b2b-hot-alarm';
import { fetchB2bLeadAlerts, type B2bLeadAlertRow } from '@/lib/b2b-lead-alerts-api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';
import { staffMe, staffRefresh } from '@/lib/api';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CrmB2bInboxPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<B2bLeadAlertRow[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [hotSound, setHotSound] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Không có quyền xem inbox B2B');
        return null;
      }
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
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const load = useCallback(async () => {
    const access = await ensureAuth();
    if (!access) return;
    setLoading(true);
    setError('');
    try {
      const me = getStoredUser();
      const scopeAll = me != null && hasCap(me, 'crm_gdkd', 'view_all_leads');
      const items = await fetchB2bLeadAlerts(access, {
        scope: scopeAll ? 'all' : undefined,
        limit: 100,
      });
      setRows(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải inbox thất bại');
    } finally {
      setLoading(false);
    }
  }, [ensureAuth]);

  useEffect(() => {
    setHotSound(isB2bHotSoundEnabled());
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const visible = useMemo(
    () => (unreadOnly ? rows.filter((row) => !row.read_at) : rows),
    [rows, unreadOnly],
  );

  const unreadCount = useMemo(() => rows.filter((row) => !row.read_at).length, [rows]);

  function toggleHotSound() {
    const next = !hotSound;
    setHotSound(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('b2bHotSound', next ? '1' : '0');
    }
  }

  return (
    <StaffPageShell
      user={user}
      onLogout={() => {
        clearSession();
        router.replace('/login');
      }}
      breadcrumb={[
        { label: 'CRM', href: '/crm' },
        { label: 'Inbox B2B', href: '/crm/b2b-inbox' },
      ]}
      loading={!user && !error}
    >
      <HubPageLayout
        title="Inbox B2B"
        subtitle="Lead mới, Hot và chờ nhận — cập nhật mỗi 15 giây"
      >
        <FilterBar>
          <FilterBarActions>
            <label className="b2b-inbox-filter">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                data-testid="b2b-inbox-unread-only"
              />
              Chưa đọc ({unreadCount})
            </label>
            <label className="b2b-inbox-filter">
              <input
                type="checkbox"
                checked={hotSound}
                onChange={toggleHotSound}
                data-testid="b2b-inbox-hot-sound"
              />
              Chuông Hot
            </label>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => void load()}>
              Làm mới
            </button>
          </FilterBarActions>
        </FilterBar>

        {error ? <p className="form-error">{error}</p> : null}
        {loading && rows.length === 0 ? <p className="muted">Đang tải…</p> : null}

        {!loading && visible.length === 0 ? (
          <p className="muted" data-testid="b2b-inbox-empty">
            {unreadOnly ? 'Không có alert chưa đọc.' : 'Inbox trống.'}
          </p>
        ) : (
          <ul className="b2b-inbox-list" data-testid="b2b-inbox-list">
            {visible.map((row) => {
              const label = alertSeverityLabel(row.severity, row.kind);
              const chipClass =
                row.severity === 'urgent'
                  ? 'b2b-inbox-chip--hot'
                  : row.kind === 'unassigned'
                    ? 'b2b-inbox-chip--inbox'
                    : 'b2b-inbox-chip--normal';
              return (
                <li key={row.id} className={`b2b-inbox-item${row.read_at ? '' : ' b2b-inbox-item--unread'}`}>
                  <div className="b2b-inbox-item__head">
                    <span className={`b2b-inbox-chip ${chipClass}`}>{label}</span>
                    <time className="muted b2b-inbox-item__time">{formatWhen(row.created_at)}</time>
                  </div>
                  <p className="b2b-inbox-item__body">
                    Lead #{row.lead_id}
                    {row.kind === 'assigned_hot' ? ' · cần gọi ngay' : ''}
                    {row.kind === 'unassigned' ? ' · chờ nhận trong dự án' : ''}
                  </p>
                  <Link href={`/crm/leads/${row.lead_id}`} className="btn btn-sm btn-secondary">
                    Mở lead
                  </Link>
                  <Link href={`/crm/b2b-inbox/thread/${row.lead_id}`} className="btn btn-sm btn-ghost">
                    Zalo thread
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </HubPageLayout>
    </StaffPageShell>
  );
}
