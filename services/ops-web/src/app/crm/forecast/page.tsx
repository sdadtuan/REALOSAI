'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ForecastCommitPanel } from '@/components/ai/ForecastCommitPanel';
import { ForecastExplainPanel, ForecastStageChart } from '@/components/ai/ForecastDashboardPanel';
import { ForecastMapeBadge } from '@/components/ai/ForecastMapeBadge';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { KpiTileGrid, type KpiTileProps } from '@/components/kpi/KpiDashboardUi';
import { formatVnd, periodLabel } from '@/lib/kpi/format';
import {
  fetchForecastDashboard,
  patchForecastCommit,
  postForecastSnapshot,
  type ForecastDashboardData,
} from '@/lib/ai-api';
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

export default function CrmForecastPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dashboard, setDashboard] = useState<ForecastDashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canView =
    user &&
    (hasCap(user, 'crm_business_dashboard', 'view') ||
      hasCap(user, 'ai_forecast', 'commit') ||
      hasCap(user, 'ai_admin', 'view'));
  const canCommit =
    user &&
    (hasCap(user, 'ai_forecast', 'commit') ||
      hasCap(user, 'crm_business_dashboard', 'configure') ||
      hasCap(user, 'ai_admin', 'view'));

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

  const loadDashboard = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const out = await fetchForecastDashboard(access, { year, month });
        setDashboard(out.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải forecast thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, month],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadDashboard(access);
    })();
  }, [ensureAuth, loadDashboard]);

  async function handleRefreshSnapshot() {
    const access = getAccessToken();
    if (!access) return;
    setLoading(true);
    setError('');
    try {
      await postForecastSnapshot(access, { force: true });
      await loadDashboard(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Snapshot thất bại');
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit(amount: number, acknowledgeMapeWarning: boolean) {
    const access = getAccessToken();
    if (!access || !dashboard?.snapshot?.id) return;
    setSaving(true);
    setError('');
    try {
      await patchForecastCommit(access, {
        snapshot_id: dashboard.snapshot.id,
        committed_amount_vnd: amount,
        acknowledge_mape_warning: acknowledgeMapeWarning,
      });
      await loadDashboard(access);
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const tiles = useMemo((): KpiTileProps[] => {
    if (!dashboard) return [];
    return [
      {
        label: 'Pipeline weighted',
        value: formatVnd(dashboard.pipeline_amount),
        hint: `${dashboard.stalled_deal_count} deal stalled`,
      },
      {
        label: 'AI gợi ý',
        value: formatVnd(dashboard.forecast_amount),
        hint:
          dashboard.ai_adjustment >= 0
            ? `+${formatVnd(dashboard.ai_adjustment)} điều chỉnh`
            : `${formatVnd(dashboard.ai_adjustment)} điều chỉnh`,
        tone: dashboard.ai_adjustment < 0 ? 'warning' : 'default',
      },
      {
        label: 'Cam kết GDKD',
        value: dashboard.is_committed ? formatVnd(dashboard.committed_amount) : '—',
        hint: dashboard.is_committed ? 'Đã chốt' : 'Chưa cam kết',
        tone: dashboard.is_committed ? 'success' : 'default',
      },
      {
        label: 'Actual (T-1)',
        value: formatVnd(dashboard.actual_prior_month_vnd),
        hint: dashboard.mape_prior_month?.month ?? 'Tháng trước',
      },
    ];
  }, [dashboard]);

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Đang tải…</p>
      </main>
    );
  }

  if (!canView) {
    return (
      <main style={{ padding: '2rem' }}>
        <p className="muted">Không có quyền Forecast dashboard (crm_business_dashboard.view).</p>
      </main>
    );
  }

  return (
    <DashboardShell
      user={user}
      onLogout={logout}
      title="Forecast doanh thu"
      periodHint={`Kỳ ${periodLabel(year, month)} · RNOS-17/18`}
      loading={loading}
      error={error || undefined}
      filters={
        <>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="kpi-input"
            aria-label="Năm"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="kpi-input"
            aria-label="Tháng"
          />
          {canCommit ? (
            <button type="button" className="btn btn-secondary" onClick={() => void handleRefreshSnapshot()}>
              Chạy snapshot
            </button>
          ) : null}
        </>
      }
    >
      <div className="forecast-page" data-testid="forecast-dashboard-page">
        <KpiTileGrid tiles={tiles} />

        <div className="forecast-page__grid">
          <section className="forecast-page__chart-card card">
            <div className="forecast-page__chart-head">
              <h3 className="kpi-section-title">Stage weighted vs pipeline raw</h3>
              <ForecastMapeBadge mape={dashboard?.mape_prior_month ?? null} />
            </div>
            <ForecastStageChart buckets={dashboard?.stage_buckets ?? []} />
          </section>

          <ForecastExplainPanel
            factors={dashboard?.factors ?? []}
            summaryNote={dashboard?.summary_note ?? ''}
            stalledDealCount={dashboard?.stalled_deal_count ?? 0}
          />
        </div>

        {canCommit ? (
          <ForecastCommitPanel
            snapshotId={dashboard?.snapshot?.id ?? null}
            suggestedAmount={dashboard?.forecast_amount ?? 0}
            canCommit={Boolean(dashboard?.can_commit)}
            isCommitted={Boolean(dashboard?.is_committed)}
            committedAmount={dashboard?.committed_amount ?? 0}
            committedBy={dashboard?.snapshot?.committed_by ?? null}
            committedAt={dashboard?.snapshot?.committed_at ?? null}
            mapePriorMonth={dashboard?.mape_prior_month ?? null}
            saving={saving}
            onSave={handleCommit}
          />
        ) : null}
      </div>
    </DashboardShell>
  );
}
