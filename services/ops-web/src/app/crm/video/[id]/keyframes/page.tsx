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
  canEditVdKeyframe,
  VIDEO_SOP_API,
  type VdJobRow,
  type VdKeyframeAssetRow,
  type VdShotRow,
} from '@/lib/video-sop-api';

const S5_BANNER = 'S5 — Keyframe thử theo shot. Gate 2 review SC-10.';
const EMPTY_KEYFRAMES = 'Chưa có keyframe — tạo job thử (S4).';
const GATE_LABEL = 'Gate 2 — SC-10';
const ENQUEUE_LABEL = 'Tạo keyframe cho shot';

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

function shaPrefix(sha: string | null | undefined): string {
  if (!sha) return '—';
  return sha.slice(0, 8);
}

export default function CrmVideoSopKeyframesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [shots, setShots] = useState<VdShotRow[]>([]);
  const [keyframes, setKeyframes] = useState<VdKeyframeAssetRow[]>([]);
  const [jobs, setJobs] = useState<VdJobRow[]>([]);
  const [selectedShotId, setSelectedShotId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enqueueing, setEnqueueing] = useState(false);

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

  const loadData = useCallback(async (access: string) => {
    const [shotRows, kfRows, jobRows] = await Promise.all([
      VIDEO_SOP_API.listProjectShots(access, projectId),
      VIDEO_SOP_API.listProjectKeyframes(access, projectId),
      VIDEO_SOP_API.listJobs(access, projectId),
    ]);
    setShots(shotRows);
    setKeyframes(kfRows.slice(0, 4));
    setJobs(jobRows);
    setSelectedShotId((prev) => prev ?? shotRows[0]?.id ?? null);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
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
        await loadData(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải keyframes thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadData, projectId, router]);

  const seedByJobId = useMemo(() => {
    const map = new Map<number, string>();
    for (const job of jobs) {
      const seed = job.output_json?.seed;
      if (seed != null) map.set(job.id, String(seed));
    }
    return map;
  }, [jobs]);

  async function enqueueKeyframe() {
    if (!selectedShotId) return;
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdKeyframe(user)) return;
    setEnqueueing(true);
    setError('');
    try {
      await VIDEO_SOP_API.enqueueShotKeyframe(
        access,
        selectedShotId,
        {},
        `ui-kf-${selectedShotId}-${Date.now()}`,
      );
      await loadData(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo keyframe thất bại');
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
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Keyframe Workbench (SC-06)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Keyframe Workbench (SC-06)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdKeyframe(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Keyframe Workbench (SC-06)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Keyframes (SC-06)' },
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
          {S5_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 220px', gap: '1rem' }}>
          <section>
            <h3 style={{ marginTop: 0 }}>Shots</h3>
            {shots.length === 0 ? <p className="muted">Chưa có shot.</p> : null}
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
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 style={{ marginTop: 0 }}>Keyframes</h3>
            {keyframes.length === 0 ? <p className="muted">{EMPTY_KEYFRAMES}</p> : null}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.75rem',
                maxWidth: '480px',
              }}
            >
              {keyframes.map((asset) => (
                <div
                  key={asset.id}
                  className="vd-kf-tile"
                  style={{
                    border: '1px solid var(--border, #d0d5dd)',
                    padding: '0.5rem',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      transform: 'scale(2)',
                      transformOrigin: 'top left',
                      width: '50%',
                      height: '48px',
                      background: 'rgba(15, 23, 42, 0.08)',
                      marginBottom: '0.5rem',
                      fontSize: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {asset.url ? asset.url : shaPrefix(asset.sha256)}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>
                    asset #{asset.id}
                    <br />
                    seed {asset.job_id != null ? (seedByJobId.get(asset.job_id) ?? '—') : '—'}
                    <br />
                    sha {shaPrefix(asset.sha256)}
                  </p>
                </div>
              ))}
            </div>
            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ marginTop: '0.75rem' }}
                disabled={enqueueing || loading || !selectedShotId}
                onClick={() => void enqueueKeyframe()}
              >
                {ENQUEUE_LABEL}
              </button>
            ) : null}
          </section>

          <section>
            <p style={{ marginTop: 0, fontWeight: 600 }}>{GATE_LABEL}</p>
            <Link href={`/crm/video/${projectId}/gates/2`} className="nav-link">
              Mở Gate 2 review →
            </Link>
          </section>
        </div>
      </div>
    </CrmDeliveryPageShell>
  );
}
