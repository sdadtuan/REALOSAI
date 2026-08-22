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
  canEditVdScript,
  sc04AddShotPayload,
  VIDEO_SOP_API,
  type VdIdeaRow,
  type VdPromptTemplateRow,
  type VdScriptRow,
  type VdShotRow,
} from '@/lib/video-sop-api';

const S3_BANNER = 'S3 — 3 cột template · ý tưởng · shotlist.';
const EMPTY_TEMPLATES = 'Chưa có template — seed DDL S3.';
const EMPTY_IDEAS = 'Chưa có ý tưởng — sinh 3 ý tưởng (S3).';
const EMPTY_SHOTS = 'Chưa có shot.';
const ASPECTS = ['9:16', '1:1'] as const;

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function latestScript(rows: VdScriptRow[]): VdScriptRow | null {
  if (rows.length === 0) return null;
  return rows.slice().sort((a, b) => b.version - a.version)[0] ?? null;
}

function shotFeasibilityLabel(shot: VdShotRow): string {
  const rows = shot.feasibility;
  if (Array.isArray(rows)) {
    const fail = rows.find((row) => !row.ok);
    return fail ? fail.id : 'OK';
  }
  if (typeof rows === 'string' && rows.trim()) return rows;
  return '—';
}

export default function CrmVideoSopScriptPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [templates, setTemplates] = useState<VdPromptTemplateRow[]>([]);
  const [ideas, setIdeas] = useState<VdIdeaRow[]>([]);
  const [scripts, setScripts] = useState<VdScriptRow[]>([]);
  const [shots, setShots] = useState<VdShotRow[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [durationMs, setDurationMs] = useState('');
  const [camera, setCamera] = useState('');
  const [action, setAction] = useState('');
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>('9:16');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingShot, setAddingShot] = useState(false);

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

  const loadStudio = useCallback(async (access: string) => {
    const [templateRows, ideaRows, scriptRows] = await Promise.all([
      VIDEO_SOP_API.listPromptTemplates(access),
      VIDEO_SOP_API.listIdeas(access, projectId),
      VIDEO_SOP_API.listScripts(access, projectId),
    ]);
    setTemplates(templateRows);
    setIdeas(ideaRows);
    setScripts(scriptRows);
    const current = latestScript(scriptRows);
    if (current) {
      setMarkdown(current.markdown);
      setShots(await VIDEO_SOP_API.listShots(access, current.id));
    } else {
      setShots([]);
    }
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
        await loadStudio(access);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải script studio thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, loadStudio, projectId, router]);

  async function generateIdeas() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdScript(user)) return;
    setGenerating(true);
    setError('');
    try {
      await VIDEO_SOP_API.generateIdeas(access, projectId, `ui-s3-ideas-${projectId}-${Date.now()}`);
      for (let i = 0; i < 8; i += 1) {
        await sleep(1000);
        const rows = await VIDEO_SOP_API.listIdeas(access, projectId);
        setIdeas(rows);
        if (rows.length >= 3) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sinh ý tưởng thất bại');
    } finally {
      setGenerating(false);
    }
  }

  async function selectIdea(ideaId: number) {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdScript(user)) return;
    setError('');
    try {
      setIdeas(await VIDEO_SOP_API.selectIdea(access, projectId, ideaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chọn ý tưởng thất bại');
    }
  }

  async function saveScript() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdScript(user)) return;
    setSaving(true);
    setError('');
    try {
      const row = await VIDEO_SOP_API.saveScript(access, projectId, markdown);
      const next = [...scripts.filter((s) => s.id !== row.id), row];
      setScripts(next);
      setShots(await VIDEO_SOP_API.listShots(access, row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu script thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function addShot() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdScript(user)) return;
    const current = latestScript(scripts);
    if (!current) {
      setError('Lưu script trước khi thêm shot');
      return;
    }
    const duration = Number(durationMs);
    if (!Number.isFinite(duration)) {
      setError('invalid_body');
      return;
    }
    setAddingShot(true);
    setError('');
    try {
      await VIDEO_SOP_API.addShot(
        access,
        current.id,
        sc04AddShotPayload({
          duration_ms: duration,
          camera,
          action,
          aspect,
        }),
      );
      setShots(await VIDEO_SOP_API.listShots(access, current.id));
      setDurationMs('');
      setCamera('');
      setAction('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm shot thất bại');
    } finally {
      setAddingShot(false);
    }
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Script Studio (SC-04)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Script Studio (SC-04)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdScript(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Script Studio (SC-04)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Script Studio (SC-04)' },
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
          {S3_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <style>{`
          @media (max-width: 900px) {
            .sc04-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <div
          className="sc04-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '1rem',
          }}
        >
          <section className="stack-gap">
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Template</h2>
            {templates.length === 0 ? <p className="muted">{EMPTY_TEMPLATES}</p> : null}
            {templates.map((row) => (
              <p key={row.code} style={{ margin: 0 }}>
                {row.code} | {row.kind}
              </p>
            ))}
          </section>

          <section className="stack-gap">
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Ý tưởng / Script</h2>
            {canEdit ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={generating || loading}
                onClick={() => void generateIdeas()}
              >
                Sinh 3 ý tưởng
              </button>
            ) : null}
            {ideas.length === 0 ? <p className="muted">{EMPTY_IDEAS}</p> : null}
            {ideas.map((idea) => (
              <div key={idea.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span>
                  {idea.selected ? '✓ ' : ''}
                  {idea.ordinal}. {idea.summary}
                </span>
                {canEdit ? (
                  <button type="button" className="btn" onClick={() => void selectIdea(idea.id)}>
                    Chọn ý tưởng
                  </button>
                ) : null}
              </div>
            ))}
            <label>
              Script
              <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={8} />
            </label>
            {canEdit ? (
              <button
                type="button"
                className="btn"
                disabled={saving || loading}
                onClick={() => void saveScript()}
              >
                Lưu script
              </button>
            ) : null}
          </section>

          <section className="stack-gap">
            <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Shotlist</h2>
            {canEdit ? (
              <>
                <label>
                  duration_ms
                  <input
                    type="number"
                    value={durationMs}
                    onChange={(e) => setDurationMs(e.target.value)}
                  />
                </label>
                <label>
                  camera
                  <input type="text" value={camera} onChange={(e) => setCamera(e.target.value)} />
                </label>
                <label>
                  action
                  <input type="text" value={action} onChange={(e) => setAction(e.target.value)} />
                </label>
                <label>
                  aspect
                  <select
                    value={aspect}
                    onChange={(e) => setAspect(e.target.value as (typeof ASPECTS)[number])}
                  >
                    {ASPECTS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={addingShot || loading}
                  onClick={() => void addShot()}
                >
                  Thêm shot
                </button>
              </>
            ) : null}
            {shots.length === 0 ? <p className="muted">{EMPTY_SHOTS}</p> : null}
            {shots.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>ordinal</th>
                      <th>duration_ms</th>
                      <th>camera</th>
                      <th>action</th>
                      <th>aspect</th>
                      <th>status</th>
                      <th>feasibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shots.map((shot) => (
                      <tr key={shot.id}>
                        <td>{shot.ordinal}</td>
                        <td>{shot.duration_ms}</td>
                        <td>{shot.camera}</td>
                        <td>{shot.action}</td>
                        <td>{shot.aspect}</td>
                        <td>{shot.status}</td>
                        <td>{shotFeasibilityLabel(shot)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </CrmDeliveryPageShell>
  );
}
