'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import {
  KpiTileGrid,
  OwnerWeeklyActionList,
  OwnerWeeklyBlockGrid,
  OwnerWeeklyConfigForm,
  ownerWeeklySummaryTiles,
} from '@/components/kpi/KpiDashboardUi';
import {
  exportOwnerWeekly,
  fetchOwnerWeeklyConfig,
  fetchOwnerWeeklyDashboard,
  patchOwnerWeeklyConfig,
  staffMe,
  staffRefresh,
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

export default function CrmOwnerWeeklyPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [week, setWeek] = useState(1);
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [targetDraft, setTargetDraft] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      if (!hasCap(me, 'crm_owner_weekly_dashboard', 'view')) {
        setError('Không có quyền Owner Weekly');
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

  const loadData = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const dash = await fetchOwnerWeeklyDashboard(access, { year, week, trend_weeks: 8 });
        setDashboard(dash);
        const me = getStoredUser();
        if (me && hasCap(me, 'crm_owner_weekly_dashboard', 'configure')) {
          const cfg = await fetchOwnerWeeklyConfig(access);
          setConfig(cfg);
          setTargetDraft((cfg.targets as Record<string, number>) ?? {});
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải owner weekly thất bại');
      } finally {
        setLoading(false);
      }
    },
    [year, week],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadData(access);
    })();
  }, [ensureAuth, loadData]);

  async function onExport() {
    const access = getAccessToken();
    if (!access) return;
    setError('');
    try {
      const bundle = await exportOwnerWeekly(access, { year, week });
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `owner-weekly-${year}-W${String(week).padStart(2, '0')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    }
  }

  async function onSaveConfig() {
    const access = getAccessToken();
    if (!access) return;
    setSaving(true);
    setError('');
    try {
      const out = await patchOwnerWeeklyConfig(access, { targets: targetDraft });
      setConfig(out);
      setTargetDraft((out.targets as Record<string, number>) ?? targetDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu config thất bại');
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const tiles = useMemo(() => ownerWeeklySummaryTiles(dashboard), [dashboard]);
  const canConfigure = hasCap(user, 'crm_owner_weekly_dashboard', 'configure');
  const canExport =
    hasCap(user, 'crm_owner_weekly_dashboard', 'export') ||
    hasCap(user, 'crm_owner_weekly_dashboard', 'view');

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
      title="Owner Weekly"
      periodHint={`Năm ${year} · Tuần ISO ${week}`}
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
            max={53}
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="kpi-input kpi-input--month"
            aria-label="Tuần ISO"
          />
          {canExport ? (
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => void onExport()}>
              Export JSON
            </button>
          ) : null}
        </>
      }
    >
      <KpiTileGrid tiles={tiles} />

      <section className="kpi-page__section">
        <h3 className="kpi-section-title">4 khối báo cáo</h3>
        <OwnerWeeklyBlockGrid dashboard={dashboard} />
      </section>

      <section className="kpi-page__section">
        <h3 className="kpi-section-title">Hành động ưu tiên</h3>
        <OwnerWeeklyActionList dashboard={dashboard} />
      </section>

      {canConfigure ? (
        <section className="kpi-page__section">
          <h3 className="kpi-section-title">Cấu hình target</h3>
          <OwnerWeeklyConfigForm
            targets={targetDraft}
            onChange={(key, value) => setTargetDraft((prev) => ({ ...prev, [key]: value }))}
          />
          <button
            type="button"
            className="btn btn-sm"
            disabled={saving}
            onClick={() => void onSaveConfig()}
            style={{ marginTop: '0.75rem' }}
          >
            {saving ? 'Đang lưu…' : 'Lưu target'}
          </button>
        </section>
      ) : null}
    </DashboardShell>
  );
}
