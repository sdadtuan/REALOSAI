'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { KpiSlaTileGrid } from '@/components/kpi/KpiSlaTileGrid';
import {
  claimLeadSolution,
  fetchKpiSolution,
  fetchSolutionQueue,
  releaseLeadToSales,
  staffMe,
  staffRefresh,
  type KpiSolutionDashboard,
  type SolutionQueueRow,
} from '@/lib/api';
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
import { resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';

export default function CrmSolutionQueuePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<SolutionQueueRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'with_solution'>('all');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyLeadId, setBusyLeadId] = useState<number | null>(null);
  const [slaTiles, setSlaTiles] = useState<KpiSolutionDashboard | null>(null);
  const solutionCaps = resolvePresalesSolutionCaps(user);

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
      if (!hasCap(me, 'crm_leads', 'view') && !hasCap(me, 'crm_presales_solution', 'view')) {
        setError('Cần quyền xem Solution queue (crm_presales_solution.view hoặc crm_leads.view)');
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
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        const me = await staffMe(out.access_token);
        setUser(me);
        updateStoredUser(me);
        return out.access_token;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = await ensureAuth();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const status = filter === 'all' ? undefined : filter;
      const [out, kpiOut] = await Promise.all([
        fetchSolutionQueue(token, { status, limit: 100 }),
        fetchKpiSolution(token).catch(() => null),
      ]);
      setRows(out.rows ?? []);
      setSlaTiles(kpiOut);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải hàng chờ Solution thất bại');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [ensureAuth, filter]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  async function onClaim(leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    setBusyLeadId(leadId);
    setMessage('');
    setError('');
    try {
      await claimLeadSolution(token, leadId);
      setMessage(`Đã nhận case Lead #${leadId}`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nhận case thất bại');
    } finally {
      setBusyLeadId(null);
    }
  }

  async function onRelease(leadId: number) {
    const token = getAccessToken();
    if (!token) return;
    if (!window.confirm(`Trả Sales Lead #${leadId} — chuyển sang Báo giá?`)) return;
    setBusyLeadId(leadId);
    setMessage('');
    setError('');
    try {
      await releaseLeadToSales(token, leadId);
      setMessage(`Đã trả Sales Lead #${leadId}`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trả Sales thất bại');
    } finally {
      setBusyLeadId(null);
    }
  }

  return (
    <StaffPageShell user={user} onLogout={logout}>
      <PageToolbar
        title="Hàng chờ Solution/MKT"
        subtitle="Lead đã handoff từ Sales — Consult + R5 → trả Sales Báo giá"
      />

      {error ? (
        <div className="lead-alert lead-alert--error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="lead-alert lead-alert--success" role="status">
          {message}
        </div>
      ) : null}

      <KpiSlaTileGrid data={slaTiles} />

      <div className="toolbar-row" style={{ marginBottom: '0.75rem' }}>
        <label className="inline-label">
          Lọc
          <select
            className="input input-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Tất cả (pending + đang xử lý)</option>
            <option value="pending">Chờ nhận</option>
            <option value="with_solution">Đang xử lý</option>
          </select>
        </label>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => void loadQueue()} disabled={loading}>
          Làm mới
        </button>
      </div>

      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : rows.length === 0 ? (
        <p className="muted">Không có lead chờ tư vấn</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Dịch vụ</th>
                <th>AM</th>
                <th>Trạng thái</th>
                <th>Giao lúc</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.lead_id}>
                  <td>
                    <Link href={`/crm/leads/${row.lead_id}`} className="nav-link">
                      #{row.lead_id} · {row.full_name || row.phone}
                    </Link>
                  </td>
                  <td>{row.service_slug || '—'}</td>
                  <td>{row.owner_name || '—'}</td>
                  <td>
                    {row.handoff_status === 'pending'
                      ? 'Chờ nhận'
                      : row.solution_owner_name
                        ? `Solution: ${row.solution_owner_name}`
                        : 'Đang xử lý'}
                  </td>
                  <td>{row.handed_off_at ? row.handed_off_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td className="table-actions">
                    <Link href={`/crm/leads/${row.lead_id}#funnel-presales`} className="btn btn-sm btn-ghost">
                      Mở
                    </Link>
                    {row.handoff_status === 'pending' ? (
                      solutionCaps.canClaim ? (
                        <button
                          type="button"
                          className="btn btn-sm"
                          disabled={busyLeadId === row.lead_id}
                          onClick={() => void onClaim(row.lead_id)}
                        >
                          Nhận case
                        </button>
                      ) : null
                    ) : solutionCaps.canRelease ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={busyLeadId === row.lead_id}
                        onClick={() => void onRelease(row.lead_id)}
                      >
                        Trả Sales
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffPageShell>
  );
}
