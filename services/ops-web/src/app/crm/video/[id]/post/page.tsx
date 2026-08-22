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
  canEditVdPost,
  VIDEO_SOP_API,
  type VdPostPipelineView,
} from '@/lib/video-sop-api';

const S8_BANNER = 'S8 — Post pipeline SC-09. DAG cố định BR-09 · QC auto BR-12.';
const ENQUEUE_LABEL = 'Enqueue cine_compose';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function statusClass(status: string): string {
  if (status === 'succeeded') return 'muted';
  if (status === 'failed') return 'error';
  if (status === 'running') return '';
  if (status === 'skipped') return 'muted';
  return 'muted';
}

export default function CrmVideoSopPostPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [pipeline, setPipeline] = useState<VdPostPipelineView | null>(null);
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

  const loadPipeline = useCallback(
    async (access: string) => {
      setPipeline(await VIDEO_SOP_API.getPostPipeline(access, projectId));
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (!access || !isVideoSopEnabled()) return;
      setLoading(true);
      setError('');
      try {
        await loadPipeline(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải post pipeline thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadPipeline, projectId]);

  async function enqueueCompose() {
    const access = await ensureAuth();
    if (!access || !canEditVdPost(user)) return;
    setEnqueueing(true);
    setError('');
    setMessage('');
    try {
      await VIDEO_SOP_API.enqueuePostCompose(access, projectId, `ui-compose-${projectId}-${Date.now()}`);
      setMessage('Job cine_compose queued — refresh sau vài giây.');
      setTimeout(() => void loadPipeline(access).catch(() => undefined), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enqueue compose thất bại');
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
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Post Pipeline (SC-09)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Post Pipeline (SC-09)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdPost(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Post Pipeline (SC-09)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Post (SC-09)' },
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
          {S8_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/cost`} className="nav-link">
            Cost (SC-11)
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        {pipeline ? (
          <>
            <p style={{ margin: 0 }}>
              Next node: <strong>{pipeline.next_node}</strong>
            </p>
            {pipeline.gate4_auto ? (
              <p style={{ margin: 0 }} className={pipeline.gate4_auto.blocked ? 'error' : 'muted'}>
                Gate 4 auto: {pipeline.gate4_auto.blocked ? 'blocked' : 'ok'}
                {pipeline.gate4_auto.reasons.length > 0
                  ? ` (${pipeline.gate4_auto.reasons.join(', ')})`
                  : ''}
              </p>
            ) : null}

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>node</th>
                    <th>label</th>
                    <th>status</th>
                    <th>job_id</th>
                  </tr>
                </thead>
                <tbody>
                  {pipeline.nodes.map((node, idx) => (
                    <tr key={node.id}>
                      <td>{idx + 1}</td>
                      <td>{node.id}</td>
                      <td>{node.label}</td>
                      <td className={statusClass(node.status)}>{node.status}</td>
                      <td>{node.job_id ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={enqueueing || loading}
            onClick={() => void enqueueCompose()}
          >
            {ENQUEUE_LABEL}
          </button>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
