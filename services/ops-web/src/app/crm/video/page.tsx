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
import { VIDEO_SOP_API, type VdProjectRow } from '@/lib/video-sop-api';

const EMPTY_COPY = 'Chọn Video chiến dịch từ Content Board';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

export default function CrmVideoSopListPage() {
  return (
    <Suspense
      fallback={
        <CrmDeliveryPageShell user={null} onLogout={() => undefined} title="Video SOP" loading>
          <span />
        </CrmDeliveryPageShell>
      }
    >
      <CrmVideoSopListContent />
    </Suspense>
  );
}

function CrmVideoSopListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lifecycleRaw = searchParams.get('lifecycle_id') ?? '';
  const lifecycleId = Number(lifecycleRaw);
  const hasLifecycle = Number.isFinite(lifecycleId) && lifecycleId > 0;

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [rows, setRows] = useState<VdProjectRow[]>([]);
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

  useEffect(() => {
    void (async () => {
      let access: string | null = null;
      try {
        access = await ensureAuth();
      } catch {
        clearSession();
        router.replace('/login');
        return;
      }
      if (!access || !isVideoSopEnabled()) return;
      if (!hasLifecycle) {
        setRows([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        setRows(await VIDEO_SOP_API.listProjects(access, lifecycleId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Video SOP thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, hasLifecycle, lifecycleId, router]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Video SOP" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Video SOP">
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
      title="Video SOP"
      subtitle="Dự án video chiến dịch (SC-01)"
    >
      <div className="page-card stack-gap">
        {hasLifecycle ? (
          <p style={{ margin: 0 }}>
            <Link href={`/crm/video/dashboard?lifecycle_id=${lifecycleId}`} className="nav-link">
              Production dashboard (SC-16)
            </Link>
          </p>
        ) : null}
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && !error && rows.length === 0 ? <p className="muted">{EMPTY_COPY}</p> : null}

        {rows.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>title</th>
                  <th>stage</th>
                  <th>status</th>
                  <th>item</th>
                  <th>updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/crm/video/${row.id}`} className="nav-link">
                        {row.title || `Video #${row.id}`}
                      </Link>
                    </td>
                    <td>{row.stage}</td>
                    <td>{row.status}</td>
                    <td>{row.cmkt_item_id ?? '—'}</td>
                    <td>{row.updated_at ? String(row.updated_at).slice(0, 10) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
