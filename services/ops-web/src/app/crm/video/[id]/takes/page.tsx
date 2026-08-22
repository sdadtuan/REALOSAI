'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type VdShotRow,
  type VdTakeView,
} from '@/lib/video-sop-api';

const S6_BANNER = 'S6 — Takes review SC-08. playbackRate 0.25 · BR-08 block sau 5 fail.';
const EMPTY_TAKES = 'Chưa có take — enqueue motion draft (SC-07).';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function TakeVideoCard({ take }: { take: VdTakeView }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el) el.playbackRate = 0.25;
  }, [take.asset_id]);

  const src = take.url?.startsWith('http') ? take.url : undefined;

  return (
    <div
      style={{
        border: '1px solid var(--border, #d0d5dd)',
        padding: '0.5rem',
        borderRadius: 4,
      }}
    >
      {src ? (
        <video ref={ref} src={src} controls style={{ width: '100%', maxHeight: 120 }} />
      ) : (
        <div
          style={{
            height: 80,
            background: 'rgba(15, 23, 42, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
          }}
        >
          take #{take.asset_id}
          <br />
          {take.sha256?.slice(0, 8) ?? 'no url'}
        </div>
      )}
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
        shot #{take.shot_id || '—'} · {take.verdict ?? 'unscored'}
      </p>
    </div>
  );
}

export default function CrmVideoSopTakesPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [takes, setTakes] = useState<VdTakeView[]>([]);
  const [shots, setShots] = useState<VdShotRow[]>([]);
  const [selectedTake, setSelectedTake] = useState<VdTakeView | null>(null);
  const [verdict, setVerdict] = useState<'passed' | 'failed'>('passed');
  const [artifactNotes, setArtifactNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const visibleTakes = useMemo(() => takes.slice(0, 4), [takes]);

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
      const [takeRows, shotRows] = await Promise.all([
        VIDEO_SOP_API.listProjectTakes(access, projectId),
        VIDEO_SOP_API.listProjectShots(access, projectId),
      ]);
      setTakes(takeRows);
      setShots(shotRows);
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
        await loadData(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải takes thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadData, projectId]);

  async function submitScore() {
    if (!selectedTake?.shot_id) {
      setError('Chọn take có shot_id hợp lệ');
      return;
    }
    const access = await ensureAuth();
    if (!access || !canEditVdMotion(user)) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await VIDEO_SOP_API.recordTakeScore(access, selectedTake.shot_id, {
        asset_id: selectedTake.asset_id,
        verdict,
        artifact_json: { notes: artifactNotes.trim() },
      });
      setMessage(`Đã ghi ${verdict} cho take #${selectedTake.asset_id}`);
      await loadData(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ghi score thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  async function selectTakeForShot() {
    if (!selectedTake?.shot_id) return;
    const access = await ensureAuth();
    if (!access || !canEditVdMotion(user)) return;
    setSubmitting(true);
    setError('');
    try {
      await VIDEO_SOP_API.selectTake(access, selectedTake.shot_id, selectedTake.asset_id);
      setMessage(`Shot #${selectedTake.shot_id} → clip_selected`);
      await loadData(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chọn take thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Takes Review (SC-08)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Takes Review (SC-08)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdMotion(user);
  const blockedShots = shots.filter((s) => s.status === 'blocked');

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Takes Review (SC-08)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Takes (SC-08)' },
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
          <Link href={`/crm/video/${projectId}/render`} className="nav-link">
            ← Render (SC-07)
          </Link>
          {' · '}
          <Link href={`/crm/video/${projectId}/gates/3`} className="nav-link">
            Gate 3 (SC-10)
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        {blockedShots.length > 0 ? (
          <p className="error">BR-08: {blockedShots.length} shot blocked (≥5 fail)</p>
        ) : null}

        {visibleTakes.length === 0 ? <p className="muted">{EMPTY_TAKES}</p> : null}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '0.75rem',
            maxWidth: 560,
          }}
        >
          {visibleTakes.map((take) => (
            <button
              key={take.asset_id}
              type="button"
              onClick={() => setSelectedTake(take)}
              style={{
                padding: 0,
                border: selectedTake?.asset_id === take.asset_id ? '2px solid #2563eb' : 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <TakeVideoCard take={take} />
            </button>
          ))}
        </div>

        {canEdit && selectedTake ? (
          <section style={{ maxWidth: 420 }}>
            <h3 style={{ marginTop: 0 }}>Score take #{selectedTake.asset_id}</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              Verdict{' '}
              <select
                value={verdict}
                onChange={(e) => setVerdict(e.target.value as 'passed' | 'failed')}
              >
                <option value="passed">passed</option>
                <option value="failed">failed</option>
              </select>
            </label>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
              artifact_json.notes
              <textarea
                value={artifactNotes}
                onChange={(e) => setArtifactNotes(e.target.value)}
                rows={3}
                style={{ width: '100%', marginTop: '0.25rem' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => void submitScore()}
              >
                Ghi score
              </button>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={() => void selectTakeForShot()}
              >
                Chọn take (clip_selected)
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
