'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { WinHomeDashboard } from '@/components/home/WinHomeDashboard';
import { fetchRenewalPortfolioSummary } from '@/lib/ai-api';
import { fetchCskhHomeSummary, staffMe, staffRefresh } from '@/lib/api';
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

const HOME_SUMMARY_POLL_MS = 60_000;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [homeSummary, setHomeSummary] = useState<Awaited<ReturnType<typeof fetchCskhHomeSummary>> | null>(
    null,
  );
  const [renewalSummary, setRenewalSummary] = useState<Awaited<
    ReturnType<typeof fetchRenewalPortfolioSummary>
  >['data'] | null>(null);
  const [homeError, setHomeError] = useState('');
  const [homeLoading, setHomeLoading] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);

    staffMe(token)
      .then((me) => {
        setUser(me);
        updateStoredUser(me);
      })
      .catch(async () => {
        const refresh = getRefreshToken();
        if (!refresh) {
          clearSession();
          router.replace('/login');
          return;
        }
        try {
          const out = await staffRefresh(refresh);
          updateAccessToken(out.access_token);
          updateStoredUser({ ...out.user, caps: undefined });
          const me = await staffMe(out.access_token);
          setUser(me);
          updateStoredUser(me);
        } catch {
          clearSession();
          router.replace('/login');
        }
      });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    if (!hasCap(user, 'crm_leads', 'view')) return;

    let cancelled = false;

    async function loadSummary() {
      const token = getAccessToken();
      if (!token) return;
      setHomeLoading(true);
      try {
        const data = await fetchCskhHomeSummary(token);
        const renewal = await fetchRenewalPortfolioSummary(token).catch(() => null);
        if (!cancelled) {
          setHomeSummary(data);
          setRenewalSummary(renewal?.data ?? null);
          setHomeError('');
        }
      } catch (err) {
        if (!cancelled) {
          setHomeError(err instanceof Error ? err.message : 'Không tải bảng điều khiển');
        }
      } finally {
        if (!cancelled) setHomeLoading(false);
      }
    }

    void loadSummary();
    const timer = window.setInterval(() => void loadSummary(), HOME_SUMMARY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user]);

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
    <StaffPageShell user={user} onLogout={logout} breadcrumb={[{ label: 'Tổng quan' }]}>
      <PageToolbar
        title={`Chào ${user.display_name || user.email}`}
        subtitle="WIN-2 · Bảng điều khiển vận hành CRM"
      />

      <WinHomeDashboard
        user={user}
        summary={homeSummary}
        renewal={renewalSummary}
        loading={homeLoading}
        error={homeError}
      />
    </StaffPageShell>
  );
}
