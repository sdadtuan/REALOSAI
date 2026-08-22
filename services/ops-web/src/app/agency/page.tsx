'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilterBar,
  FilterBarActions,
  FilterBarSearch,
  HubPageLayout,
  StaffPageShell,
} from '@/components/layout';
import { AgencyReadOnlyBadge, canAgencyWrite } from '@/components/AgencyReadOnlyBadge';
import { WinScopeBadge } from '@/components/rbac/WinScopeBadge';
import {
  fetchAgencyClients,
  fetchAgencyNotifications,
  fetchAgencyStats,
  staffMe,
  staffRefresh,
} from '@/lib/api';
import type { AgencyClient } from '@/lib/api';
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

export default function AgencyPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [stats, setStats] = useState<{ pg_ready: boolean; clients: Record<string, number>; jobs: Record<string, number> } | null>(null);
  const [unread, setUnread] = useState(0);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!hasCap(me, 'crm_agency', 'view')) {
        setError('Không có quyền Agency');
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

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setToken(access);
      setLoading(true);
      setError('');
      try {
        const [st, list, notif] = await Promise.all([
          fetchAgencyStats(access),
          fetchAgencyClients(access, {
            q: q.trim() || undefined,
            status: statusFilter || undefined,
          }),
          fetchAgencyNotifications(access).catch(() => ({ notifications: [], unread: 0 })),
        ]);
        setStats(st);
        setClients(list.clients);
        setUnread(notif.unread);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải agency thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, q, statusFilter]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  function onFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (token) {
      void fetchAgencyClients(token, {
        q: q.trim() || undefined,
        status: statusFilter || undefined,
      }).then((r) => setClients(r.clients));
    }
  }

  const clientTotal = Object.values(stats?.clients ?? {}).reduce((a, b) => a + b, 0);
  const pendingJobs = stats?.jobs?.pending ?? 0;
  const deadJobs = stats?.jobs?.dead ?? 0;
  const onboardingCount = stats?.clients?.onboarding ?? 0;
  const activeCount = stats?.clients?.active ?? 0;
  const archivedCount = stats?.clients?.archived ?? 0;
  const canWrite = user ? canAgencyWrite(user) : false;

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      loading={!user}
      agencyUnread={unread}
      breadcrumb={[{ label: 'Agency', href: '/agency' }, { label: 'Clients' }]}
    >
      {deadJobs > 0 ? (
        <div className="agency-dlq-banner" role="alert">
          <strong>DLQ:</strong> {deadJobs} job dead —{' '}
          <Link href="/agency/jobs?status=dead" className="nav-link">
            xem ingest pipeline
          </Link>
        </div>
      ) : null}

      <HubPageLayout
        title="Agency ops"
        subtitle="PG primary · Nest API"
        headerExtra={<AgencyReadOnlyBadge user={user} />}
        actions={
          <>
            {canWrite ? (
              <Link href="/agency/clients/new" className="btn btn-sm">
                + Client
              </Link>
            ) : null}
            <Link href="/agency/ingest" className="btn btn-secondary btn-sm">
              Ingest
            </Link>
            <Link href="/agency/notifications" className="btn btn-secondary btn-sm">
              Thông báo{unread > 0 ? ` (${unread})` : ''}
            </Link>
            <Link href="/agency/kpi-definitions" className="btn btn-secondary btn-sm">
              KPI definitions
            </Link>
            <Link href="/crm/hub" className="btn btn-secondary btn-sm">
              Hub map
            </Link>
          </>
        }
      >
        <div className="agency-stat-grid channel-hub-summary">
          <div className="agency-stat-card">
            <strong>{stats?.pg_ready ? clientTotal : '—'}</strong>
            <span className="muted">Clients</span>
          </div>
          <div className="agency-stat-card">
            <strong>{activeCount}</strong>
            <span className="muted">Active</span>
          </div>
          <div className="agency-stat-card">
            <strong>{onboardingCount}</strong>
            <span className="muted">Onboarding</span>
          </div>
          <div className="agency-stat-card">
            <strong>{pendingJobs}</strong>
            <span className="muted">Jobs pending</span>
          </div>
          <div className="agency-stat-card">
            <strong>{archivedCount}</strong>
            <span className="muted">Archived</span>
          </div>
        </div>

        <FilterBar onSubmit={onFilterSubmit}>
          <FilterBarSearch value={q} onChange={setQ} placeholder="Tìm code, tên client…" />
          <select
            className="kpi-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Lọc trạng thái"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">active</option>
            <option value="onboarding">onboarding</option>
            <option value="prospect">prospect</option>
            <option value="paused">paused</option>
            <option value="archived">archived</option>
          </select>
          <FilterBarActions>
            <button type="submit" className="btn btn-sm btn-secondary" disabled={loading}>
              Lọc
            </button>
          </FilterBarActions>
        </FilterBar>

        {error ? <p className="error">{error}</p> : null}

        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Tên</th>
                <th>Trạng thái</th>
                <th>Kênh</th>
                <th>AM</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/agency/clients/${c.id}`} className="nav-link">
                      {c.code}
                    </Link>
                  </td>
                  <td>{c.name} <WinScopeBadge clientId={c.id} /></td>
                  <td>
                    <span
                      className={`agency-status-badge badge-${
                        c.status === 'active'
                          ? 'active'
                          : c.status === 'onboarding'
                            ? 'onboarding'
                            : c.status === 'archived' || c.tenant_locked
                              ? 'paused'
                              : 'prospect'
                      }`}
                    >
                      {c.status}
                      {c.tenant_locked ? ' · locked' : ''}
                    </span>
                  </td>
                  <td>{c.channels || '—'}</td>
                  <td>{c.owner_am_id || '—'}</td>
                </tr>
              ))}
              {!loading && clients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted agency-empty">
                    Không có client
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </HubPageLayout>
    </StaffPageShell>
  );
}
