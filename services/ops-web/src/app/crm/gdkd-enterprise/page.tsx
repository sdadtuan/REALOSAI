'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import {
  fetchGdkdEnterpriseKpi,
  staffMe,
  staffRefresh,
  type GdkdEnterpriseKpiResponse,
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

function tileTone(pass: boolean | null): KpiTileProps['tone'] {
  if (pass === true) return 'success';
  if (pass === false) return 'critical';
  return 'warning';
}

function passLabel(pass: boolean | null): string {
  if (pass === true) return 'Đạt';
  if (pass === false) return 'Chưa đạt';
  return 'Chưa có số liệu';
}

export default function GdkdEnterprisePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [days, setDays] = useState(7);
  const [data, setData] = useState<GdkdEnterpriseKpiResponse | null>(null);
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
      if (!hasCap(me, 'crm_kpi_records', 'view') && !hasCap(me, 'crm_business_dashboard', 'view')) {
        setError('Không có quyền xem KPI enterprise GDKD');
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

  const reload = useCallback(async () => {
    const access = await ensureAuth();
    if (!access) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchGdkdEnterpriseKpi(access, days);
      setData(out);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Tải KPI enterprise thất bại');
    } finally {
      setLoading(false);
    }
  }, [days, ensureAuth]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const tiles = useMemo<KpiTileProps[]>(() => {
    if (!data) return [];
    return data.tiles.map((tile) => ({
      label: tile.label,
      value: tile.value_display,
      hint: `${tile.target_display} · ${passLabel(tile.pass)}`,
      tone: tileTone(tile.pass),
      href: tile.drill_href,
    }));
  }, [data]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  return (
    <DashboardShell
      user={user}
      onLogout={logout}
      title="KPI Enterprise GDKD"
      periodHint="8 chỉ số CSKH vận hành 24h + AI pilot + closed-loop chốt"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'KPI Enterprise GDKD' },
      ]}
      loading={loading}
      error={error}
      width="wide"
      filters={
        <>
          <label className="kpi-filter-field">
            <span className="muted">Cửa sổ AI/NBA</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
          </label>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
            Làm mới
          </button>
        </>
      }
    >
      {data ? (
        <>
          <div
            className={`banner ${data.summary.fail_count > 0 ? 'banner-warning' : 'banner-success'}`}
            style={{ marginBottom: '1rem' }}
            role="status"
          >
            <strong>
              {data.summary.pass_count}/{data.summary.total} KPI đạt
            </strong>
            {data.summary.fail_count > 0 ? (
              <span style={{ marginLeft: '0.75rem' }}>
                {data.summary.fail_count} chưa đạt · {data.summary.na_count} thiếu số liệu
              </span>
            ) : null}
            <span className="muted" style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>
              Cập nhật {new Date(data.generated_at).toLocaleString('vi-VN')} · closed-loop{' '}
              {data.closed_loop_window_days} ngày
            </span>
          </div>

          <KpiTileGrid tiles={tiles} />

          <section className="page-card stack-gap" style={{ marginTop: '1.25rem' }}>
            <h3 className="kpi-section-title">Chi tiết KPI</h3>
            <div className="table-wrap">
              <table className="data-table gdkd-enterprise-kpi-table">
                <thead>
                  <tr>
                    <th>KPI</th>
                    <th>Thực tế</th>
                    <th>Target</th>
                    <th>Trạng thái</th>
                    <th>Nguồn</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.tiles.map((tile) => (
                    <tr key={tile.id}>
                      <td>
                        <strong>{tile.label}</strong>
                        {tile.detail ? (
                          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                            {tile.detail}
                          </p>
                        ) : null}
                      </td>
                      <td>{tile.value_display}</td>
                      <td>{tile.target_display}</td>
                      <td>
                        <span className={tile.pass === true ? 'success' : tile.pass === false ? 'error' : 'warning'}>
                          {passLabel(tile.pass)}
                        </span>
                      </td>
                      <td className="muted">{tile.source}</td>
                      <td>
                        <Link href={tile.drill_href} className="nav-link">
                          Drill-down →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </DashboardShell>
  );
}
