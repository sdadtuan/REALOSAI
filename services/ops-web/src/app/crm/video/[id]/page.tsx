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
import { canEnqueueVdJob, VIDEO_SOP_API, type VdJobRow, type VdProjectRow } from '@/lib/video-sop-api';

const S9_BANNER = 'S9 — Delivery SC-13 + Gate 4 live. Post · Cost · Portal review.';
const ENQUEUE_LABEL = 'Tạo job keyframe thử';
const EMPTY_JOBS = 'Chưa có job — tạo keyframe thử (S2).';
const AUTH_FAIL_NOTE = 'Thiếu Leonardo/Flux key — job failed auth là đúng S2.';

function jobAssetLine(job: VdJobRow): string | null {
  const out = job.output_json;
  if (!out || out.asset_id == null || out.asset_id === '') return null;
  const provider = out.provider != null ? String(out.provider) : '';
  const seed = out.seed != null ? String(out.seed) : '';
  return `asset #${out.asset_id} · ${provider} · ${seed}`;
}

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

export default function CrmVideoSopDetailPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [project, setProject] = useState<VdProjectRow | null>(null);
  const [jobs, setJobs] = useState<VdJobRow[]>([]);
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
        const [row, jobRows] = await Promise.all([
          VIDEO_SOP_API.getProject(access, projectId),
          VIDEO_SOP_API.listJobs(access, projectId),
        ]);
        setProject(row);
        setJobs(jobRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Video SOP thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, projectId, router]);

  async function enqueueKeyframe() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEnqueueVdJob(user)) return;
    setEnqueueing(true);
    setError('');
    try {
      await VIDEO_SOP_API.enqueueJob(
        access,
        projectId,
        {
          queue: 'q.image',
          job_type: 'cine_keyframe',
          payload: { prompt: 'S2 smoke keyframe', width: 1024, height: 1024 },
        },
        `ui-s2-${projectId}-${Date.now()}`,
      );
      setJobs(await VIDEO_SOP_API.listJobs(access, projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo job thất bại');
    } finally {
      setEnqueueing(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  const hasAuthFail = jobs.some((job) => job.status === 'failed' && job.error_class === 'auth');

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
      title={project?.title || (projectId ? `Video #${projectId}` : 'Video SOP')}
      subtitle="Tổng quan dự án (SC-02)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: project?.title || `#${projectId}` },
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
          {S9_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}/brief`} className="nav-link">
            Brief (SC-03)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/script`} className="nav-link">
            Script (SC-04)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/bible`} className="nav-link">
            Bible (SC-05)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/keyframes`} className="nav-link">
            Keyframes (SC-06)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/gates/1`} className="nav-link">
            Gate 1 (SC-10)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/gates/2`} className="nav-link">
            Gate 2 (SC-10)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/render`} className="nav-link">
            Render (SC-07)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/takes`} className="nav-link">
            Takes (SC-08)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/gates/3`} className="nav-link">
            Gate 3 (SC-10)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/cost`} className="nav-link">
            Cost (SC-11)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/post`} className="nav-link">
            Post (SC-09)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/gates/4`} className="nav-link">
            Gate 4 (SC-10)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/delivery`} className="nav-link">
            Delivery (SC-13)
          </Link>
        </p>
        <p style={{ margin: 0 }}>
          <Link href="/admin/video/providers" className="nav-link">
            Admin providers
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {project ? (
          <dl style={{ margin: 0, display: 'grid', gap: '0.45rem' }}>
            <div>
              <dt className="muted">id</dt>
              <dd style={{ margin: 0 }}>{project.id}</dd>
            </div>
            <div>
              <dt className="muted">stage</dt>
              <dd style={{ margin: 0 }}>{project.stage}</dd>
            </div>
            <div>
              <dt className="muted">cmkt_item_id</dt>
              <dd style={{ margin: 0 }}>{project.cmkt_item_id ?? '—'}</dd>
            </div>
            <div>
              <dt className="muted">lifecycle Content OS</dt>
              <dd style={{ margin: 0 }}>
                <Link
                  href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}
                  className="nav-link"
                >
                  lifecycle #{project.lifecycle_id}
                </Link>
              </dd>
            </div>
          </dl>
        ) : null}

        {canEnqueueVdJob(user) ? (
          <div>
            <button
              type="button"
              className="btn btn-primary"
              disabled={enqueueing || loading || !project}
              onClick={() => void enqueueKeyframe()}
            >
              {ENQUEUE_LABEL}
            </button>
          </div>
        ) : null}

        {!loading && jobs.length === 0 ? <p className="muted">{EMPTY_JOBS}</p> : null}

        {jobs.length > 0 ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>id</th>
                  <th>queue</th>
                  <th>job_type</th>
                  <th>status</th>
                  <th>error_class</th>
                  <th>attempt</th>
                  <th>updated</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const assetLine = jobAssetLine(job);
                  return (
                    <tr key={job.id}>
                      <td>{job.id}</td>
                      <td>{job.queue}</td>
                      <td>{job.job_type}</td>
                      <td>
                        {job.status}
                        {assetLine ? (
                          <>
                            <br />
                            <span className="muted">{assetLine}</span>
                          </>
                        ) : null}
                      </td>
                      <td>{job.error_class ?? '—'}</td>
                      <td>{job.attempt}</td>
                      <td>{job.updated_at ? String(job.updated_at) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {hasAuthFail ? <p className="muted">{AUTH_FAIL_NOTE}</p> : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
