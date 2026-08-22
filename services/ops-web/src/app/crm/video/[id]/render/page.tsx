'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
  canEditVdMotion,
  VIDEO_SOP_API,
  type VdRenderEstimate,
  type VdShotRow,
} from '@/lib/video-sop-api';

const S6_BANNER = 'S6 — Motion render SC-07. BR-07 final cần take draft passed.';
const ENQUEUE_DRAFT = 'Enqueue draft motion';
const ENQUEUE_FINAL = 'Enqueue final motion';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function truncateAction(action: string, max = 40): string {
  const trimmed = action.trim();
  if (trimmed.length <= max) return trimmed || '—';
  return `${trimmed.slice(0, max)}…`;
}

export default function CrmVideoSopRenderPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [shots, setShots] = useState<VdShotRow[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<number | null>(null);
  const [jobType, setJobType] = useState<'cine_motion_draft' | 'cine_motion_final'>(
    'cine_motion_draft',
  );
  const [estimate, setEstimate] = useState<VdRenderEstimate | null>(null);
  const [confirmBudget, setConfirmBudget] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);
  const [message, setMessage] = useState('');

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

  const loadShots = useCallback(
    async (access: string) => {
      const rows = await VIDEO_SOP_API.listProjectShots(access, projectId);
      setShots(rows);
      if (!selectedShotId && rows.length > 0) setSelectedShotId(rows[0].id);
    },
    [projectId, selectedShotId],
  );

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access || !isVideoSopEnabled()) return;
      setLoading(true);
      setError('');
      try {
        await loadShots(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải shots thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadShots, projectId]);

  useEffect(() => {
    if (!selectedShotId || !projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const est = await VIDEO_SOP_API.getRenderEstimate(access, projectId, selectedShotId, jobType);
        setEstimate(est);
        setConfirmBudget(!est.needs_confirm);
      } catch (err) {
        setEstimate(null);
        setError(err instanceof Error ? err.message : 'Ước tính credit thất bại');
      }
    })();
  }, [ensureAuth, jobType, projectId, selectedShotId]);

  async function enqueueMotion(type: 'cine_motion_draft' | 'cine_motion_final') {
    if (!selectedShotId) return;
    setJobType(type);
    const access = await ensureAuth();
    if (!access || !canEditVdMotion(user)) return;
    let est = estimate;
    if (!est || est.job_type !== type) {
      try {
        est = await VIDEO_SOP_API.getRenderEstimate(access, projectId, selectedShotId, type);
        setEstimate(est);
      } catch {
        est = null;
      }
    }
    if (est?.needs_confirm && !confirmBudget) {
      setError('Xác nhận vượt ngưỡng budget trước khi submit');
      return;
    }
    setEnqueueing(true);
    setError('');
    setMessage('');
    try {
      const key = `ui-motion-${selectedShotId}-${type}-${Date.now()}`;
      if (type === 'cine_motion_final') {
        await VIDEO_SOP_API.enqueueShotMotionFinal(access, selectedShotId, key);
      } else {
        await VIDEO_SOP_API.enqueueShotMotionDraft(access, selectedShotId, {}, key);
      }
      setMessage(`Job ${type} queued — xem Takes (SC-08) sau vài giây.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enqueue motion thất bại');
    } finally {
      setEnqueueing(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Motion Render (SC-07)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Motion Render (SC-07)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdMotion(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Motion Render (SC-07)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Render (SC-07)' },
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
          {S6_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/takes`} className="nav-link">
            Takes (SC-08)
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1rem' }}>
          <section>
            <h3 style={{ marginTop: 0 }}>Shots</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {shots.map((shot) => (
                <li key={shot.id} style={{ marginBottom: '0.35rem' }}>
                  <button
                    type="button"
                    className={selectedShotId === shot.id ? 'btn btn-primary' : 'btn'}
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => setSelectedShotId(shot.id)}
                  >
                    #{shot.ordinal} · {truncateAction(shot.action)}
                    <br />
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      {shot.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 style={{ marginTop: 0 }}>Credit estimate</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Job type{' '}
              <select
                value={jobType}
                onChange={(e) =>
                  setJobType(e.target.value as 'cine_motion_draft' | 'cine_motion_final')
                }
              >
                <option value="cine_motion_draft">cine_motion_draft</option>
                <option value="cine_motion_final">cine_motion_final</option>
              </select>
            </label>
            {estimate ? (
              <dl style={{ margin: 0, display: 'grid', gap: '0.35rem' }}>
                <div>
                  <dt className="muted">credit_estimate</dt>
                  <dd style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                    {estimate.credit_estimate}
                  </dd>
                </div>
                <div>
                  <dt className="muted">alert_threshold</dt>
                  <dd style={{ margin: 0 }}>{estimate.alert_threshold}</dd>
                </div>
                {estimate.needs_confirm ? (
                  <div>
                    <label>
                      <input
                        type="checkbox"
                        checked={confirmBudget}
                        onChange={(e) => setConfirmBudget(e.target.checked)}
                      />{' '}
                      Xác nhận vượt ngưỡng budget ({estimate.credit_estimate} &gt;{' '}
                      {estimate.alert_threshold})
                    </label>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="muted">Chọn shot để xem ước tính.</p>
            )}
            {canEdit ? (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={enqueueing || !selectedShotId}
                  onClick={() => void enqueueMotion('cine_motion_draft')}
                >
                  {ENQUEUE_DRAFT}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={enqueueing || !selectedShotId}
                  onClick={() => void enqueueMotion('cine_motion_final')}
                >
                  {ENQUEUE_FINAL}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </CrmDeliveryPageShell>
  );
}
