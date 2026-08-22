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
  canEditVdBible,
  VIDEO_SOP_API,
  type VdCharacterBibleItem,
} from '@/lib/video-sop-api';

const S4_BANNER = 'S4 — Style + Character bible. BR-03 lock region.';
const EMPTY_CHARACTERS = 'Chưa có nhân vật — thêm nhân vật (S4).';

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function emptyCharacter(): VdCharacterBibleItem {
  return { name: '', lock_regions: [], notes: '' };
}

export default function CrmVideoSopBiblePage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [palette, setPalette] = useState('');
  const [lens, setLens] = useState('');
  const [lighting, setLighting] = useState('');
  const [refs, setRefs] = useState('');
  const [characters, setCharacters] = useState<VdCharacterBibleItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);
  const [savingCharacters, setSavingCharacters] = useState(false);

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
        const [style, chars] = await Promise.all([
          VIDEO_SOP_API.getStyleBible(access, projectId),
          VIDEO_SOP_API.getCharacterBible(access, projectId),
        ]);
        const styleBody = style.body_json ?? { palette: [], lens: '', lighting: '', refs: [] };
        setPalette((styleBody.palette ?? []).join(', '));
        setLens(styleBody.lens ?? '');
        setLighting(styleBody.lighting ?? '');
        setRefs((styleBody.refs ?? []).join(', '));
        setCharacters(chars.body_json?.items?.length ? chars.body_json.items : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải bible thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, projectId, router]);

  async function saveStyle() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdBible(user)) return;
    setSavingStyle(true);
    setError('');
    try {
      await VIDEO_SOP_API.saveStyleBible(access, projectId, {
        palette: palette.split(',').map((s) => s.trim()).filter(Boolean),
        lens: lens.trim(),
        lighting: lighting.trim(),
        refs: refs.split(',').map((s) => s.trim()).filter(Boolean),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu style thất bại');
    } finally {
      setSavingStyle(false);
    }
  }

  async function saveCharacters() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdBible(user)) return;
    setSavingCharacters(true);
    setError('');
    try {
      const items = characters
        .map((row) => ({
          name: row.name.trim(),
          lock_regions: row.lock_regions,
          notes: row.notes.trim(),
        }))
        .filter((row) => row.name);
      await VIDEO_SOP_API.saveCharacterBible(access, projectId, { items });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu characters thất bại');
    } finally {
      setSavingCharacters(false);
    }
  }

  function updateCharacter(index: number, patch: Partial<VdCharacterBibleItem>) {
    setCharacters((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Bible (SC-05)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Bible (SC-05)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdBible(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Bible (SC-05)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Bible (SC-05)' },
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
          {S4_BANNER}
        </p>
        <p style={{ margin: 0 }}>
          <Link href={`/crm/video/${projectId}`} className="nav-link">
            ← Video #{projectId}
          </Link>
        </p>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <fieldset>
          <legend>Style bible</legend>
          <label>
            Palette (comma)
            <input type="text" value={palette} onChange={(e) => setPalette(e.target.value)} />
          </label>
          <label>
            Lens
            <input type="text" value={lens} onChange={(e) => setLens(e.target.value)} />
          </label>
          <label>
            Lighting
            <input type="text" value={lighting} onChange={(e) => setLighting(e.target.value)} />
          </label>
          <label>
            Refs (comma)
            <input type="text" value={refs} onChange={(e) => setRefs(e.target.value)} />
          </label>
          {canEdit ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={savingStyle || loading}
              onClick={() => void saveStyle()}
            >
              Lưu style
            </button>
          ) : null}
        </fieldset>

        <fieldset>
          <legend>Character bible</legend>
          {characters.length === 0 ? <p className="muted">{EMPTY_CHARACTERS}</p> : null}
          {characters.map((row, index) => (
            <div key={index} style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <label>
                name
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateCharacter(index, { name: e.target.value })}
                />
              </label>
              <label>
                lock_regions (comma)
                <input
                  type="text"
                  value={row.lock_regions.join(', ')}
                  onChange={(e) =>
                    updateCharacter(index, {
                      lock_regions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </label>
              <label>
                notes
                <input
                  type="text"
                  value={row.notes}
                  onChange={(e) => updateCharacter(index, { notes: e.target.value })}
                />
              </label>
            </div>
          ))}
          {canEdit ? (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                disabled={loading}
                onClick={() => setCharacters((prev) => [...prev, emptyCharacter()])}
              >
                Thêm nhân vật
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingCharacters || loading}
                onClick={() => void saveCharacters()}
              >
                Lưu characters
              </button>
            </div>
          ) : null}
        </fieldset>
      </div>
    </CrmDeliveryPageShell>
  );
}
