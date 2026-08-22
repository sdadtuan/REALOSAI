'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardShell } from '@/components/kpi/DashboardShell';
import { FinancialIntelligencePanel, type FinanceIntelligenceData } from '@/components/kpi/FinancialIntelligencePanel';
import { FinancialLifecycleTable } from '@/components/kpi/FinancialLifecycleTable';
import {
  ArAgingPanel,
  KpiTileGrid,
  financialSummaryTiles,
} from '@/components/kpi/KpiDashboardUi';
import { periodLabel } from '@/lib/kpi/format';
import {
  fetchFinanceArAging,
  fetchFinanceFinancials,
  fetchFinanceIntelligence,
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

export default function CrmFinancialsPage() {
  const router = useRouter();
  const now = new Date();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [financials, setFinancials] = useState<Record<string, unknown> | null>(null);
  const [arAging, setArAging] = useState<Record<string, unknown> | null>(null);
  const [intelligence, setIntelligence] = useState<FinanceIntelligenceData | null>(null);
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
      if (!hasCap(me, 'crm_business_dashboard', 'view')) {
        setError('Không có quyền Financials');
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
        const [fin, ar, intel] = await Promise.all([
          fetchFinanceFinancials(access, { year, month }),
          fetchFinanceArAging(access),
          fetchFinanceIntelligence(access, { year, month, months: 6 }),
        ]);
        setFinancials(fin);
        setArAging(ar.buckets ? ar : (fin.ar_aging as Record<string, unknown>) ?? ar);
        setIntelligence(intel as FinanceIntelligenceData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải financials thất bại');
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
      await loadData(access);
    })();
  }, [ensureAuth, loadData]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const summaryTiles = useMemo(
    () => financialSummaryTiles(financials, arAging),
    [financials, arAging],
  );
  const rows = (financials?.rows ?? []) as Array<Record<string, unknown>>;

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
      title="Financials — lifecycle margin"
      periodHint={`Kỳ ${periodLabel(year, month)} · burn rate · margin at risk · front-office view`}
      loading={loading}
      error={error}
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
            className="kpi-input kpi-input--month"
            aria-label="Tháng"
          />
        </>
      }
      footer="Front-office only — không thay ERP MISA (sổ cái, HĐ GTGT, tồn kho). Xuất connector riêng nếu cần."
    >
      <KpiTileGrid tiles={summaryTiles} />

      <section className="kpi-page__section">
        <FinancialIntelligencePanel data={intelligence} />
      </section>

      <section className="kpi-page__section kpi-page__section--split">
        <div>
          <h3 className="kpi-section-title">Lifecycle ({rows.length})</h3>
          <FinancialLifecycleTable rows={rows} />
        </div>
        <div>
          <h3 className="kpi-section-title">AR aging</h3>
          <ArAgingPanel arAging={arAging} />
        </div>
      </section>
    </DashboardShell>
  );
}
