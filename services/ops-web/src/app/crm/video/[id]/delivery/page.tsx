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
  canEditVdQc,
  VIDEO_SOP_API,
  type VdDeliveryView,
  type VdPostPipelineView,
  type VdReviewLinkView,
} from '@/lib/video-sop-api';

const S9_BANNER =
  'S9 — Delivery SC-13 + Portal SC-14. BR-14 TTL ≤14 ngày · BR-15 contains_human + ai_disclosure.';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

export default function CrmVideoSopDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [delivery, setDelivery] = useState<VdDeliveryView | null>(null);
  const [pipeline, setPipeline] = useState<VdPostPipelineView | null>(null);
  const [reviewLink, setReviewLink] = useState<VdReviewLinkView | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [packaging, setPackaging] = useState(false);
  const [linking, setLinking] = useState(false);
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

  const loadData = useCallback(
    async (access: string) => {
      setLoading(true);
      setError('');
      try {
        const [del, post] = await Promise.all([
          VIDEO_SOP_API.getDelivery(access, projectId),
          VIDEO_SOP_API.getPostPipeline(access, projectId),
        ]);
        setDelivery(del);
        setPipeline(post);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải delivery thất bại');
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (!projectId) return;
    void (async () => {
      const access = await ensureAuth();
      if (access) await loadData(access);
    })();
  }, [ensureAuth, loadData, projectId]);

  async function createPackage() {
    const access = await ensureAuth();
    if (!access || !canEditVdPost(user)) return;
    setPackaging(true);
    setError('');
    setMessage('');
    try {
      await VIDEO_SOP_API.createDeliveryPackage(access, projectId);
      setMessage('Editor package đã tạo.');
      await loadData(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo package thất bại');
    } finally {
      setPackaging(false);
    }
  }

  async function createReviewLink() {
    const access = await ensureAuth();
    if (!access || !canEditVdQc(user)) return;
    setLinking(true);
    setError('');
    setMessage('');
    try {
      const jobs = await VIDEO_SOP_API.listJobs(access, projectId);
      const compose = jobs.find((row) => row.job_type === 'cine_compose');
      const assetRaw = compose?.output_json?.asset_id;
      const assetId = assetRaw != null ? Number(assetRaw) : 0;
      const assetIds = assetId > 0 ? [assetId] : [1];
      const link = await VIDEO_SOP_API.createReviewLink(access, {
        project_id: Number(projectId),
        gate_no: 4,
        asset_ids: assetIds,
        ttl_days: 14,
        watermark_label: 'PTT Client Review',
      });
      setReviewLink(link);
      setMessage('Review link TTL 14 ngày đã tạo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo review link thất bại');
    } finally {
      setLinking(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Delivery (SC-13)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Delivery (SC-13)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const pkg = delivery?.package;

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Delivery (SC-13)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Delivery (SC-13)' },
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
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/post`} className="nav-link">
            Post (SC-09)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/gates/4`} className="nav-link">
            Gate 4 (SC-10)
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}

        {delivery ? (
          <>
            <dl style={{ margin: 0, display: 'grid', gap: '0.45rem' }}>
              <div>
                <dt className="muted">Gate 4 status</dt>
                <dd style={{ margin: 0 }}>{delivery.gate4_status}</dd>
              </div>
              <div>
                <dt className="muted">QC auto pass</dt>
                <dd style={{ margin: 0 }}>{delivery.qc_auto_pass ? 'yes' : 'no'}</dd>
              </div>
            </dl>

            {pkg ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>package #</th>
                      <th>files (SOP naming)</th>
                      <th>contains_human</th>
                      <th>ai_disclosure</th>
                      <th>created</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{pkg.id}</td>
                      <td>{pkg.file_names_json.join(', ')}</td>
                      <td>{pkg.meta_json.contains_human ? 'true' : 'false'}</td>
                      <td>{pkg.meta_json.ai_disclosure ? 'true' : 'false'}</td>
                      <td>{new Date(pkg.created_at).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">Chưa có editor package.</p>
            )}

            {canEditVdPost(user) ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={packaging || loading}
                onClick={() => void createPackage()}
              >
                Tạo editor package
              </button>
            ) : null}

            {canEditVdQc(user) ? (
              <div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={linking || loading}
                  onClick={() => void createReviewLink()}
                >
                  Tạo portal review link (14 ngày)
                </button>
                {reviewLink ? (
                  <p style={{ margin: '0.5rem 0 0' }} className="muted">
                    Portal SC-14:{' '}
                    <Link href={reviewLink.portal_path} className="nav-link" target="_blank">
                      {reviewLink.portal_path}
                    </Link>
                    {' · '}
                    token <code>{reviewLink.token.slice(0, 12)}…</code>
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
