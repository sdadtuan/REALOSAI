'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { KpiEditableGrid } from '@/components/kpi/KpiEditableGrid';
import { KpiTeamToggle, type KpiTeamOption } from '@/components/kpi/KpiTeamToggle';
import {
  KpiAlertList,
  KpiBarChart,
  KpiTileGrid,
  KpiTrendPanel,
  type KpiTileProps,
} from '@/components/kpi/KpiDashboardUi';
import { periodLabel } from '@/lib/kpi/format';
import {
  downloadStaffKpiXlsx,
  fetchKpiBoard,
  fetchKpiChart,
  fetchKpiMetricTrend,
  fetchKpiMetrics,
  fetchStaffKpi,
  patchStaffKpiProgress,
  staffMe,
  staffRefresh,
  type KpiChartData,
  type KpiMetricRow,
  type StaffKpiGridEntry,
} from '@/lib/api';
import { fetchAiAcceptanceMetrics, type AiAcceptanceMetrics } from '@/lib/ai-api';
import { formatPct } from '@/lib/kpi/format';
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
import { winKpiSolutionEnabled } from '@/lib/win/flags';
import Link from 'next/link';

export default function CrmKpiPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [team, setTeam] = useState<KpiTeamOption>('all');
  const [metrics, setMetrics] = useState<KpiMetricRow[]>([]);
  const [board, setBoard] = useState<Awaited<ReturnType<typeof fetchKpiBoard>> | null>(null);
  const [chartMetricId, setChartMetricId] = useState('');
  const [chartData, setChartData] = useState<KpiChartData | null>(null);
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [trendSeries, setTrendSeries] = useState<number[]>([]);
  const [aiAcceptance, setAiAcceptance] = useState<AiAcceptanceMetrics | null>(null);
  const [gridRows, setGridRows] = useState<StaffKpiGridEntry[]>([]);
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

  const loadTrend = useCallback(async (access: string, metricId: string) => {
    if (!metricId) {
      setTrendLabels([]);
      setTrendSeries([]);
      return;
    }
    try {
      const trend = await fetchKpiMetricTrend(access, {
        metric_id: Number(metricId),
        year,
        month,
        months: 6,
      });
      setTrendLabels(trend.labels ?? []);
      setTrendSeries(trend.avg_achievement_pct ?? []);
    } catch {
      setTrendLabels([]);
      setTrendSeries([]);
    }
  }, [year, month]);

  const loadPage = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const [metricRows, boardOut, aiMetricsOut, staffKpiRows] = await Promise.all([
          fetchKpiMetrics(access),
          fetchKpiBoard(access, { year, month, team: team === 'all' ? undefined : team }),
          fetchAiAcceptanceMetrics(access, { days: 7 }).catch(() => null),
          fetchStaffKpi(access, { year, month }).catch(() => []),
        ]);
        setMetrics(metricRows);
        setBoard(boardOut);
        setGridRows(staffKpiRows);
        setAiAcceptance(aiMetricsOut?.data ?? null);
        const nextMetricId = chartMetricId || (metricRows[0] ? String(metricRows[0].id) : '');
        if (!chartMetricId && metricRows[0]) {
          setChartMetricId(String(metricRows[0].id));
        }
        if (nextMetricId) {
          const chart = await fetchKpiChart(access, {
            metric_id: Number(nextMetricId),
            year,
            month,
            team: team === 'all' ? undefined : team,
          });
          setChartData(chart);
          await loadTrend(access, nextMetricId);
        } else {
          setChartData(null);
          setTrendLabels([]);
          setTrendSeries([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải KPI thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, month, chartMetricId, loadTrend, team],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadPage(access);
    })();
  }, [ensureAuth, loadPage]);

  async function reloadChart(nextMetricId = chartMetricId) {
    const access = getAccessToken();
    if (!access || !nextMetricId) return;
    setError('');
    try {
      setChartData(
        await fetchKpiChart(access, {
          metric_id: Number(nextMetricId),
          year,
          month,
          team: team === 'all' ? undefined : team,
        }),
      );
      await loadTrend(access, nextMetricId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải biểu đồ thất bại');
    }
  }

  async function onExportExcel() {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      await downloadStaffKpiXlsx(access, { year, month });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export Excel thất bại');
    }
  }

  async function onGridSaved() {
    const access = getAccessToken();
    if (!access) return;
    await loadPage(access);
  }

  async function onPatchGridActual(kpiId: number, actual: number | null) {
    const access = getAccessToken();
    if (!access) throw new Error('Phiên đăng nhập hết hạn');
    await patchStaffKpiProgress(access, kpiId, { actual_value: actual });
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const tiles = useMemo((): KpiTileProps[] => {
    const summary = board?.summary ?? { critical: 0, warn: 0 };
    const rate = aiAcceptance?.acceptance_rate_pct;
    const aiTone =
      rate == null ? 'default' : rate >= 35 ? 'success' : rate >= 20 ? 'warning' : 'critical';
    return [
      {
        label: 'Nhân viên có KPI',
        value: String(board?.staff_count ?? 0),
        hint: periodLabel(year, month),
      },
      {
        label: 'Chỉ tiêu ghi nhận',
        value: String(board?.kpi_count ?? 0),
        hint: `${metrics.length} metric định nghĩa`,
      },
      {
        label: 'Tỷ lệ chấp nhận AI',
        value: rate == null ? '—' : formatPct(rate),
        hint: `G6 · 7 ngày · ${aiAcceptance?.accepted ?? 0}/${aiAcceptance?.total_resolved ?? 0}`,
        tone: aiTone,
        href: '/crm/ai/insights',
      },
      {
        label: 'Cảnh báo nghiêm trọng',
        value: String(summary.critical ?? 0),
        tone: (summary.critical ?? 0) > 0 ? 'critical' : 'success',
      },
      {
        label: 'Cảnh báo vàng',
        value: String(summary.warn ?? 0),
        tone: (summary.warn ?? 0) > 0 ? 'warning' : 'default',
      },
    ];
  }, [board, metrics.length, year, month, aiAcceptance]);

  const canEditKpi = hasCap(user, 'crm_kpi_records', 'edit');

  const chartItems = useMemo(() => {
    if (!chartData) return [];
    const staffIds = chartData.staff_ids ?? [];
    return (chartData.labels ?? []).map((label, index) => ({
      label,
      value: chartData.achievement_pct?.[index] ?? null,
      href: staffIds[index] ? `/crm/staff/${staffIds[index]}` : undefined,
    }));
  }, [chartData]);

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
      title="Chỉ tiêu KPI"
      periodHint={`Kỳ ${periodLabel(year, month)} · xu hướng 6 tháng theo chỉ tiêu đã chọn`}
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
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onExportExcel()}>
            Export Excel
          </button>
          {winKpiSolutionEnabled() ? (
            <Link href="/crm/kpi/solution" className="btn btn-sm btn-secondary">
              KPI Solution
            </Link>
          ) : null}
        </>
      }
    >
      <KpiTileGrid tiles={tiles} />

      <section className="kpi-page__section kpi-page__section--split">
        <div>
          <div className="kpi-page__chart-head">
            <h3 className="kpi-section-title">So sánh NV theo chỉ tiêu</h3>
            <div className="kpi-page__filters">
              <select
                value={chartMetricId}
                onChange={(e) => {
                  setChartMetricId(e.target.value);
                  void reloadChart(e.target.value);
                }}
                className="kpi-select"
                aria-label="Chỉ tiêu biểu đồ"
              >
                {metrics.map((m) => (
                  <option key={m.id} value={String(m.id)}>
                    {m.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" onClick={() => void reloadChart()}>
                Làm mới
              </button>
            </div>
          </div>
          <KpiBarChart
            title={String(chartData?.metric?.name ?? 'Đạt KPI (%)')}
            items={chartItems}
            unit="%"
            maxValue={100}
          />
          <KpiTrendPanel
            title="TB đạt KPI (6 tháng)"
            labels={trendLabels}
            series={trendSeries}
            valueFormatter={(v) => formatPct(v)}
          />
        </div>
        <div>
          <h3 className="kpi-section-title">Cảnh báo tháng</h3>
          <KpiAlertList alerts={board?.alerts ?? []} />
        </div>
      </section>

      <section className="kpi-page__section">
        <h3 className="kpi-section-title">Nhập actual KPI</h3>
        <KpiEditableGrid
          rows={gridRows}
          canEdit={canEditKpi}
          onPatch={onPatchGridActual}
          onSaved={onGridSaved}
        />
      </section>

      <details className="kpi-page__metrics-details">
        <summary className="muted">Danh sách metric định nghĩa ({metrics.length})</summary>
        <ul className="kpi-metric-list">
          {metrics.map((m) => (
            <li key={m.id}>
              {m.code ? `[${m.code}] ` : ''}
              {m.name}
              {m.unit ? ` (${m.unit})` : ''}
            </li>
          ))}
        </ul>
      </details>
    </DashboardShell>
  );
}
