'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CrmDeliveryPageShell } from '@/components/crm/CrmDeliveryPageShell';
import { staffMe, staffRefresh } from '@/lib/api';
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
import { VIDEO_SOP_API, type VdProductionReport } from '@/lib/video-sop-api';

const S10_BANNER =
  'S10 — Production dashboard SC-16. 7 benchmark KPI (BA §10.3) — hiển thị mục tiêu, API không fail khi lệch.';

const METRIC_LABELS: Record<string, string> = {
  kf_pass_rate: 'Keyframe pass rate',
  clip_pass_rate: 'Clip pass rate',
  takes_per_shot: 'Takes / shot',
  credit_ratio: 'Credit ratio',
  client_rounds: 'Client rounds',
  lead_days: 'Lead days',
  override_rate: 'Override rate',
};

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function formatValue(metric: string, value: number): string {
  if (metric === 'client_rounds' || metric === 'lead_days' || metric === 'takes_per_shot') {
    return value.toFixed(1);
  }
  if (metric.endsWith('_rate')) {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(2);
}

function CrmVideoSopDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lifecycleRaw = searchParams.get('lifecycle_id') ?? '3';
  const lifecycleId = Number(lifecycleRaw);

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [report, setReport] = useState<VdProductionReport | null>(null);
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
      if (!canViewVideoSop(me)) {
        setError('Không có quyền Video SOP');
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
        access = out.access_token;
        const me = await staffMe(access);
        setUser(me);
        updateStoredUser(me);
        if (!canViewVideoSop(me)) {
          setError('Không có quyền Video SOP');
          return null;
        }
        return access;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  const loadReport = useCallback(
    async (access: string) => {
      if (!Number.isFinite(lifecycleId) || lifecycleId <= 0) {
        setError('Thiếu lifecycle_id hợp lệ (?lifecycle_id=)');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const row = await VIDEO_SOP_API.getProductionReport(access, lifecycleId);
        setReport(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải production report thất bại');
      } finally {
        setLoading(false);
      }
    },
    [lifecycleId],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (access) await loadReport(access);
    })();
  }, [ensureAuth, loadReport]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Production Dashboard (SC-16)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Production Dashboard (SC-16)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Production Dashboard (SC-16)"
      subtitle={`Lifecycle #${lifecycleId}`}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: 'Dashboard (SC-16)' },
      ]}
    >
      <div className="page-card stack-gap">
        <p
          style={{
            margin: 0,
            padding: '0.75rem 1rem',
            border: '1px solid var(--border, #d0d5dd)',
            background: 'rgba(15, 23, 42, 0.04)',
          }}
        >
          {S10_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video?lifecycle_id=${lifecycleId}`} className="nav-link">
            ← Danh sách project
          </Link>
          {' · '}
          <Link href={`/crm/service-delivery/${lifecycleId}?tab=content-os`} className="nav-link">
            Content OS lifecycle
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {report ? (
          <>
            <p style={{ margin: 0 }} className="muted">
              {report.project_count} project · lifecycle #{report.lifecycle_id}
            </p>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>metric</th>
                    <th>value</th>
                    <th>KPI mục tiêu</th>
                    <th>on track</th>
                  </tr>
                </thead>
                <tbody>
                  {report.metrics.map((row) => (
                    <tr key={row.metric}>
                      <td>{METRIC_LABELS[row.metric] ?? row.metric}</td>
                      <td>{formatValue(row.metric, row.value)}</td>
                      <td>{row.target.label}</td>
                      <td className={row.on_track ? 'muted' : 'error'}>
                        {row.on_track ? 'yes' : 'no'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}

export default function CrmVideoSopDashboardPage() {
  return (
    <Suspense
      fallback={
        <CrmDeliveryPageShell user={null} onLogout={() => undefined} title="Production Dashboard" loading>
          <span />
        </CrmDeliveryPageShell>
      }
    >
      <CrmVideoSopDashboardContent />
    </Suspense>
  );
}
