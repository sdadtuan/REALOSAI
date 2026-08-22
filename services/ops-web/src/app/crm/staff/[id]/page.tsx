'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CrmHrPageShell } from '@/components/crm/CrmHrPageShell';
import { EmployeeFileShell } from '@/components/hr/EmployeeFileShell';
import { KpiSparkline } from '@/components/kpi/KpiDashboardUi';
import { fetchCrmStaffWorkspace, staffMe, staffRefresh } from '@/lib/api';
import { formatVnd } from '@/lib/kpi/format';
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

const PAGE_SIZE = 10;

type WorkspaceCase = {
  id: number;
  title: string;
  status_label?: string;
  pipeline_stage?: string;
  deal_value_vnd?: number;
  customer_name?: string;
  updated_at?: string;
};

function CrmWorkspacePanel({
  bundle,
  page,
  setPage,
}: {
  bundle: Record<string, unknown>;
  page: number;
  setPage: (fn: (p: number) => number) => void;
}) {
  const stats = (bundle?.stats as Record<string, number>) ?? {};
  const cases = (bundle?.cases as WorkspaceCase[]) ?? [];

  const sparkData = useMemo(() => {
    const buckets = new Array(8).fill(0);
    for (const c of cases) {
      const raw = String(c.updated_at ?? '').slice(0, 10);
      if (!raw) continue;
      const ageDays = Math.floor((Date.now() - new Date(raw).getTime()) / 86_400_000);
      const idx = Math.min(Math.max(Math.floor(ageDays / 7), 0), buckets.length - 1);
      buckets[buckets.length - 1 - idx] += Number(c.deal_value_vnd ?? 0) / 1_000_000;
    }
    return buckets.some((v) => v > 0)
      ? buckets
      : cases.slice(0, 8).map((c) => Number(c.deal_value_vnd ?? 0) / 1_000_000);
  }, [cases]);

  const totalPages = Math.max(1, Math.ceil(cases.length / PAGE_SIZE));
  const pageCases = cases.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="page-card stack-gap">
      <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
        Case mở {stats.open ?? 0} · Ưu tiên cao {stats.high_priority ?? 0} · SLA quá hạn {stats.sla_overdue ?? 0}
      </p>
      <section>
        <p className="muted" style={{ margin: '0 0 0.35rem', fontSize: '0.85rem' }}>
          Giá trị case (triệu VND) — 8 tuần gần nhất
        </p>
        <KpiSparkline data={sparkData} label="Xu hướng case được gán" />
      </section>
      {cases.length === 0 ? (
        <p className="muted">Chưa có case gán.</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Khách</th>
                  <th>Stage</th>
                  <th>Giá trị</th>
                </tr>
              </thead>
              <tbody>
                {pageCases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/crm/leads/${c.id}`}>#{c.id}</Link> · {c.title}
                    </td>
                    <td>{c.customer_name || '—'}</td>
                    <td>{c.status_label ?? c.pipeline_stage ?? '—'}</td>
                    <td>{formatVnd(Number(c.deal_value_vnd ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Trước
              </button>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                Trang {page}/{totalPages} · {cases.length} case
              </span>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau →
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function CrmStaffDetailPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = Number(params.id);
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

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
      if (!hasCap(me, 'crm_staff_roster', 'view')) {
        setError('Không có quyền');
        return null;
      }
      setToken(access);
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
      setToken(access);
      return access;
    }
  }, [router]);

  useEffect(() => {
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setError('ID không hợp lệ');
      setLoading(false);
      return;
    }
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      try {
        setBundle(await fetchCrmStaffWorkspace(access, staffId));
        setPage(1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải workspace thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, staffId]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const staff = (bundle?.staff as Record<string, unknown>) ?? {};

  if (!user) {
    return (
      <CrmHrPageShell user={null} onLogout={logout} title="Nhân viên" hideToolbar loading>
        <span />
      </CrmHrPageShell>
    );
  }

  return (
    <CrmHrPageShell
      user={user}
      onLogout={logout}
      title={String(staff.name ?? `#${staffId}`)}
      hideToolbar
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Nhân sự', href: '/crm/hr' },
        { label: String(staff.name ?? `#${staffId}`) },
      ]}
    >
      <p className="detail-page-back">
        <Link href="/crm/staff" className="btn btn-sm btn-ghost">
          ← Nhân viên
        </Link>
      </p>
      {loading ? <p className="muted">Đang tải…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {profileError ? <p className="error">{profileError}</p> : null}
      {token && !error ? (
        <EmployeeFileShell
          staffId={staffId}
          token={token}
          user={user}
          onProfileError={setProfileError}
          crmPanel={
            bundle ? <CrmWorkspacePanel bundle={bundle} page={page} setPage={setPage} /> : (
              <p className="muted">Đang tải CRM workspace…</p>
            )
          }
        />
      ) : null}
    </CrmHrPageShell>
  );
}
