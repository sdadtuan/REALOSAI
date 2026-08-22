'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { KpiSlaTileGrid } from '@/components/kpi/KpiSlaTileGrid';
import { KpiTeamToggle, type KpiTeamOption } from '@/components/kpi/KpiTeamToggle';
import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import { PresalesFunnelMetricsCard } from '@/components/PresalesFunnelMetricsCard';
import { periodLabel } from '@/lib/kpi/format';
import { fetchKpiSolution, staffMe, staffRefresh, type KpiSolutionDashboard } from '@/lib/api';
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

export default function CrmKpiSolutionPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [team, setTeam] = useState<KpiTeamOption>('solution');
  const [data, setData] = useState<KpiSolutionDashboard | null>(null);
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
      if (!hasCap(me, 'crm_kpi_records', 'view')) {
        setError('Không có quyền KPI');
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

  const loadPage = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        setData(
          await fetchKpiSolution(access, {
            year,
            month,
            team: team === 'all' ? undefined : team,
          }),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải KPI Solution thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, month, team],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadPage(access);
    })();
  }, [ensureAuth, loadPage]);

  const summaryTiles = useMemo((): KpiTileProps[] => {
    if (!data) return [];
    const q = data.queue;
    const sla = data.sla;
    return [
      {
        label: 'Kỳ báo cáo',
        value: periodLabel(data.year, data.month),
        hint: `${data.period_start} → ${data.period_end}`,
      },
      {
        label: 'Team filter',
        value: team === 'all' ? 'Tất cả' : team.toUpperCase(),
        hint: 'Đồng bộ với KPI org board',
      },
      {
        label: 'Consult đang mở',
        value: String(sla.active_consult),
        tone: sla.active_consult > 10 ? 'warning' : 'default',
      },
      {
        label: 'Queue Solution',
        value: String(q.pending + q.with_solution),
        hint: `${q.pending} chờ · ${q.with_solution} đang xử lý`,
        href: '/crm/solution/queue',
      },
    ];
  }, [data, team]);

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
      title="KPI Solution & Pre-sales"
      periodHint={`VUX-07 · số liệu từ API /api/crm/kpi/solution · Kỳ ${periodLabel(year, month)}`}
      loading={loading}
      error={error}
      filters={
        <>
          <KpiTeamToggle value={team} onChange={setTeam} />
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Năm"
            className="kpi-input"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            aria-label="Tháng"
            className="kpi-input kpi-input--month"
          />
          <Link href="/crm/kpi" className="btn btn-sm btn-secondary">
            ← KPI tổng
          </Link>
        </>
      }
    >
      <KpiTileGrid tiles={summaryTiles} />
      <section className="kpi-page__section">
        <h3 className="kpi-section-title">SLA & queue (Solution moat)</h3>
        <KpiSlaTileGrid data={data} />
      </section>
      {data?.funnel ? (
        <section className="kpi-page__section">
          <PresalesFunnelMetricsCard data={data.funnel} />
        </section>
      ) : null}
    </DashboardShell>
  );
}
