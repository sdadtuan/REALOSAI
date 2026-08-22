'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
import {
  canApproveVdGate,
  VIDEO_SOP_API,
  type VdGateView,
} from '@/lib/video-sop-api';

const BANNER: Record<number, string> = {
  1: 'S5 — Gate 1 shotlist. BR-04 immutable sau approve.',
  2: 'S5 — Gate 2 keyframe. AC-R3 animating.',
  3: 'S6 — Gate 3 takes. Cần ≥1 shot clip_selected.',
  4: 'S9 — Gate 4 QC auto BR-12. Approve → delivered.',
};

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function parseGateNo(raw: string): number | null {
  const n = Number(raw);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

export default function CrmVideoSopGateReviewPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');
  const gateNo = parseGateNo(String(params.n ?? ''));

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [gate, setGate] = useState<VdGateView | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);

  const canApprove = useMemo(
    () => (gateNo != null ? canApproveVdGate(user, gateNo) : false),
    [user, gateNo],
  );

  const checklistOk = gate?.checklist.every((item) => item.ok) ?? false;

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

  const reloadGate = useCallback(
    async (access: string) => {
      if (gateNo == null) return;
      const row = await VIDEO_SOP_API.getGate(access, projectId, gateNo);
      setGate(row);
    },
    [gateNo, projectId],
  );

  useEffect(() => {
    if (!projectId || gateNo == null) return;
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
      setLoading(true);
      setError('');
      try {
        await reloadGate(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải gate thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, gateNo, projectId, reloadGate, router]);

  async function onApprove(useOverride: boolean) {
    if (gateNo == null) return;
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canApprove) return;
    if (useOverride && overrideReason.trim().length < 10) {
      setError('Override reason cần ≥10 ký tự');
      return;
    }
    setActing(true);
    setError('');
    try {
      await VIDEO_SOP_API.approveGate(access, projectId, gateNo, {
        override: useOverride,
        override_reason: useOverride ? overrideReason.trim() : undefined,
      });
      await reloadGate(access);
      setOverride(false);
      setOverrideReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve thất bại');
    } finally {
      setActing(false);
    }
  }

  async function onReject() {
    if (gateNo == null) return;
    const reason = rejectReason.trim();
    if (!reason) {
      setError('Reject cần lý do');
      return;
    }
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canApprove) return;
    setActing(true);
    setError('');
    try {
      await VIDEO_SOP_API.rejectGate(access, projectId, gateNo, { reason });
      await reloadGate(access);
      setRejectReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reject thất bại');
    } finally {
      setActing(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Gate Review (SC-10)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Gate Review (SC-10)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  if (gateNo == null) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Gate Review (SC-10)">
        <div className="page-card">
          <p className="error">Gate không hợp lệ — chỉ hỗ trợ Gate 1 hoặc 2 (S5).</p>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const gateLabel = `Gate ${gateNo}`;

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Gate Review (SC-10)"
      subtitle={gateLabel}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: gateLabel },
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
          {BANNER[gateNo]}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
          {gateNo === 1 ? (
            <>
              {' · '}
              <Link href={`/crm/video/${projectId}/script`} className="nav-link">
                Script (SC-04)
              </Link>
            </>
          ) : (
            <>
              {' · '}
              <Link href={`/crm/video/${projectId}/keyframes`} className="nav-link">
                Keyframes (SC-06)
              </Link>
            </>
          )}
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {gate ? (
          <dl style={{ margin: 0, display: 'grid', gap: '0.45rem' }}>
            <div>
              <dt className="muted">status</dt>
              <dd style={{ margin: 0 }}>{gate.status}</dd>
            </div>
            <div>
              <dt className="muted">stage</dt>
              <dd style={{ margin: 0 }}>{gate.stage}</dd>
            </div>
          </dl>
        ) : null}

        {gate && gate.checklist.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Checklist</th>
                  <th>OK</th>
                </tr>
              </thead>
              <tbody>
                {gate.checklist.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>{item.ok ? '✓' : '✗'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {canApprove && gate?.status === 'pending' ? (
          <div className="stack-gap" style={{ display: 'grid', gap: '0.75rem', maxWidth: '32rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={acting || loading || !checklistOk}
                onClick={() => void onApprove(false)}
              >
                Approve
              </button>
              <button
                type="button"
                className="btn"
                disabled={acting || loading}
                onClick={() => void onReject()}
              >
                Reject
              </button>
            </div>
            <label>
              Reject reason
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
              />
              Override (bỏ qua checklist)
            </label>
            {override ? (
              <label>
                Override reason (≥10 ký tự)
                <textarea
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  style={{ width: '100%' }}
                />
              </label>
            ) : null}
            {override ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={acting || loading || overrideReason.trim().length < 10}
                onClick={() => void onApprove(true)}
              >
                Override
              </button>
            ) : null}
          </div>
        ) : null}

        {gate?.status === 'approved' ? (
          <p className="muted">Gate đã approved — stage đã chuyển theo AC-R3.</p>
        ) : null}
        {gate?.status === 'rejected' ? (
          <p className="muted">Gate rejected — xem rework và sửa trước khi approve lại.</p>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
