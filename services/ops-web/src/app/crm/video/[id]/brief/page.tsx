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
  canEditVdBrief,
  VIDEO_SOP_API,
  type VdBriefInsight,
} from '@/lib/video-sop-api';

const S3_BANNER = 'S3 — 8 nhóm SOP. Insight M6 được để trống.';
const EMPTY_INSIGHTS = 'Không có insight approved — được để trống.';

const PLATFORMS = ['reels', 'shorts', 'feed_square'] as const;

function canViewVideoSop(user: StoredStaffUser | null): boolean {
  return hasCap(user, 'crm_vd.project', 'view') || hasCap(user, 'crm_content', 'view');
}

function isVideoSopEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC === '1';
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asDuration(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function asInsightIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is number => typeof id === 'number' && Number.isFinite(id));
}

export default function CrmVideoSopBriefPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = String(params.id ?? '');

  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [stage, setStage] = useState('');
  const [objective, setObjective] = useState('');
  const [audience, setAudience] = useState('');
  const [offer, setOffer] = useState('');
  const [durationSec, setDurationSec] = useState('');
  const [platform, setPlatform] = useState('');
  const [tone, setTone] = useState('');
  const [constraints, setConstraints] = useState('');
  const [insightIds, setInsightIds] = useState<number[]>([]);
  const [insights, setInsights] = useState<VdBriefInsight[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [marking, setMarking] = useState(false);

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
        const [brief, insightRows] = await Promise.all([
          VIDEO_SOP_API.getBrief(access, projectId),
          VIDEO_SOP_API.listBriefInsights(access, projectId),
        ]);
        const body = brief.body_json ?? {};
        setStage(brief.stage);
        setObjective(asString(body.objective));
        setAudience(asString(body.audience));
        setOffer(asString(body.offer));
        setDurationSec(asDuration(body.duration_sec));
        setPlatform(asString(body.platform));
        setTone(asString(body.tone));
        setConstraints(asString(body.constraints));
        setInsightIds(asInsightIds(body.insight_ids));
        setInsights(insightRows);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải brief thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth, projectId, router]);

  function briefBody(): Record<string, unknown> {
    const duration = Number(durationSec);
    return {
      objective,
      audience,
      offer,
      duration_sec: Number.isFinite(duration) && durationSec.trim() ? duration : durationSec,
      platform,
      tone,
      constraints,
      insight_ids: insightIds,
    };
  }

  async function saveBrief() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdBrief(user)) return;
    setSaving(true);
    setError('');
    try {
      const row = await VIDEO_SOP_API.saveBrief(access, projectId, briefBody());
      setStage(row.stage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu brief thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function markReady() {
    let access: string | null = null;
    try {
      access = await ensureAuth();
    } catch {
      clearSession();
      router.replace('/login');
      return;
    }
    if (!access || !canEditVdBrief(user)) return;
    setMarking(true);
    setError('');
    try {
      const row = await VIDEO_SOP_API.markBriefReady(access, projectId);
      setStage(row.stage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đánh dấu brief thất bại');
    } finally {
      setMarking(false);
    }
  }

  function toggleInsight(id: number) {
    setInsightIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user) {
    return (
      <CrmDeliveryPageShell user={null} onLogout={logout} title="Brief (SC-03)" loading>
        <span />
      </CrmDeliveryPageShell>
    );
  }

  if (!isVideoSopEnabled()) {
    return (
      <CrmDeliveryPageShell user={user} onLogout={logout} title="Brief (SC-03)">
        <div className="page-card">
          <p>Module tắt</p>
        </div>
      </CrmDeliveryPageShell>
    );
  }

  const canEdit = canEditVdBrief(user);

  return (
    <CrmDeliveryPageShell
      user={user}
      onLogout={logout}
      title="Brief (SC-03)"
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Video SOP', href: '/crm/video' },
        { label: `#${projectId}`, href: `/crm/video/${projectId}` },
        { label: 'Brief (SC-03)' },
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
        {stage ? (
          <p style={{ margin: 0 }}>
            <span className="muted">stage</span> {stage}
          </p>
        ) : null}
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}

        <label>
          Mục tiêu
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} />
        </label>
        <label>
          Đối tượng
          <textarea value={audience} onChange={(e) => setAudience(e.target.value)} rows={2} />
        </label>
        <label>
          Offer
          <textarea value={offer} onChange={(e) => setOffer(e.target.value)} rows={2} />
        </label>
        <label>
          Thời lượng (giây)
          <input
            type="number"
            value={durationSec}
            onChange={(e) => setDurationSec(e.target.value)}
            min={15}
            max={60}
          />
        </label>
        <label>
          Nền tảng
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">—</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tone
          <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} />
        </label>
        <label>
          Ràng buộc
          <textarea value={constraints} onChange={(e) => setConstraints(e.target.value)} rows={2} />
        </label>
        <fieldset>
          <legend>Insights M6</legend>
          {insights.length === 0 ? <p className="muted">{EMPTY_INSIGHTS}</p> : null}
          {insights.map((item) => (
            <label key={item.id} style={{ display: 'block' }}>
              <input
                type="checkbox"
                checked={insightIds.includes(item.id)}
                onChange={() => toggleInsight(item.id)}
              />{' '}
              {item.title}
            </label>
          ))}
        </fieldset>

        {canEdit ? (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || loading}
              onClick={() => void saveBrief()}
            >
              Lưu brief
            </button>
            <button
              type="button"
              className="btn"
              disabled={marking || loading}
              onClick={() => void markReady()}
            >
              Đánh dấu brief sẵn sàng
            </button>
          </div>
        ) : null}
      </div>
    </CrmDeliveryPageShell>
  );
}
