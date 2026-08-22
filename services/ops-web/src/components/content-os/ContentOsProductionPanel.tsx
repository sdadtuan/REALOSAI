'use client';

import { useEffect, useState } from 'react';
import {
  fetchContentOsBridgeSeoStatus,
  fetchContentOsBridgeEmailStatus,
  getEmBridgeHref,
  patchContentOsProduction,
  postContentOsBridgeEmail,
  postContentOsBridgeSeo,
  postContentOsExportDesignBrief,
  postContentOsExportDesignBriefPdf,
  postContentOsExportScript,
  postContentOsProductionDone,
  postContentOsSeoSync,
  type ContentOsItem,
} from '@/lib/content-os-api';

const PRODUCTION_PHASES = [
  'none',
  'awaiting_design',
  'awaiting_video',
  'in_progress',
  'done',
] as const;

interface Props {
  token: string;
  lifecycleId: number;
  item: ContentOsItem;
  canWrite: boolean;
  canProduction: boolean;
  emailClientId?: string | null;
  emailClientLinked?: boolean;
  onChanged: () => void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsProductionPanel({
  token,
  lifecycleId,
  item,
  canWrite,
  canProduction,
  emailClientId: lifecycleEmailClientId = null,
  emailClientLinked = false,
  onChanged,
  onMessage,
  onError,
}: Props) {
  const prod = (item.production_json ?? {}) as Record<string, unknown>;
  const [phase, setPhase] = useState(String(prod.phase ?? 'none'));
  const [designerId, setDesignerId] = useState(String(prod.assignee_designer_id ?? ''));
  const [videoId, setVideoId] = useState(String(prod.assignee_video_id ?? ''));
  const [assetUrl, setAssetUrl] = useState('');
  const [assetUrls, setAssetUrls] = useState<string[]>(
    Array.isArray(prod.asset_urls) ? (prod.asset_urls as string[]) : [],
  );
  const [creativeId, setCreativeId] = useState(String(prod.creative_id ?? ''));
  const [notes, setNotes] = useState(String(prod.notes ?? ''));
  const [seoStatus, setSeoStatus] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchContentOsBridgeSeoStatus(token, lifecycleId, item.id)
      .then((s) => setSeoStatus(s.linked ? s.workflow_status : null))
      .catch(() => setSeoStatus(null));
    void fetchContentOsBridgeEmailStatus(token, lifecycleId, item.id)
      .then((s) => setEmailStatus(s.linked ? s.status : null))
      .catch(() => setEmailStatus(null));
  }, [token, lifecycleId, item.id]);

  const saveProduction = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await patchContentOsProduction(token, lifecycleId, item.id, patch);
      onMessage('Đã cập nhật production');
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Cập nhật production thất bại');
    } finally {
      setSaving(false);
    }
  };

  const downloadExport = async (kind: 'brief' | 'brief_pdf' | 'script') => {
    try {
      if (kind === 'brief_pdf') {
        const res = await postContentOsExportDesignBriefPdf(token, lifecycleId, item.id);
        const bytes = Uint8Array.from(atob(res.content_base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: res.content_type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        onMessage(`Đã export ${res.filename}`);
        return;
      }
      const res =
        kind === 'brief'
          ? await postContentOsExportDesignBrief(token, lifecycleId, item.id)
          : await postContentOsExportScript(token, lifecycleId, item.id);
      const blob = new Blob([res.content], { type: res.content_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      onMessage(`Đã export ${res.filename}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Export thất bại');
    }
  };

  const emHref = getEmBridgeHref(item);
  const seoHref = item.seo_bridge_id ? `/seo/content/${item.seo_bridge_id}` : null;

  return (
    <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.75rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Production & bridges</strong>

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
        {item.channel === 'website' && item.format === 'blog' ? (
          <span className="badge">
            SEO: {seoStatus ?? (item.seo_bridge_id ? 'linked' : 'not linked')}
            {seoHref ? (
              <>
                {' '}
                <a href={seoHref} target="_blank" rel="noreferrer">
                  mở
                </a>
              </>
            ) : null}
          </span>
        ) : null}
        {['newsletter', 'drip'].includes(item.channel) ? (
          <span className="badge">
            Email: {emailStatus ?? (emHref ? 'linked' : 'not linked')}
            {emHref ? (
              <>
                {' '}
                <a href={emHref} target="_blank" rel="noreferrer">
                  mở
                </a>
              </>
            ) : null}
          </span>
        ) : null}
        {prod.creative_id ? <span className="badge">Creative: {String(prod.creative_id)}</span> : null}
      </div>

      {canWrite && item.channel === 'website' && item.format === 'blog' && item.seo_bridge_id ? (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              const out = await postContentOsSeoSync(token, lifecycleId, item.id);
              onMessage(out.synced ? `Đã sync URL: ${out.published_url}` : 'SEO chưa published — chưa sync');
              if (out.synced) onChanged();
            } catch (err) {
              onError(err instanceof Error ? err.message : 'SEO sync thất bại');
            } finally {
              setSaving(false);
            }
          }}
        >
          Sync SEO published URL
        </button>
      ) : null}

      {canWrite && item.channel === 'website' && item.format === 'blog' && !item.seo_bridge_id ? (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await postContentOsBridgeSeo(token, lifecycleId, item.id);
              onMessage('Đã bridge SEO pipeline');
              onChanged();
            } catch (err) {
              onError(err instanceof Error ? err.message : 'SEO bridge thất bại');
            } finally {
              setSaving(false);
            }
          }}
        >
          → SEO pipeline
        </button>
      ) : null}

      {canWrite &&
      ['newsletter', 'drip'].includes(item.channel) &&
      !emHref &&
      item.status === 'approved_internal' ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          {emailClientLinked && lifecycleEmailClientId ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Email client: <code>{lifecycleEmailClientId}</code> (từ lifecycle)
            </p>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--warning, #e6a700)' }}>
              HĐ chưa liên kết agency client — gán trên hợp đồng trước khi bridge.
            </p>
          )}
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={saving || !emailClientLinked}
            onClick={async () => {
              setSaving(true);
              try {
                await postContentOsBridgeEmail(token, lifecycleId, item.id, {
                  client_id: lifecycleEmailClientId?.trim() || undefined,
                });
                onMessage('Đã tạo draft email campaign');
                onChanged();
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Email bridge thất bại');
              } finally {
                setSaving(false);
              }
            }}
          >
            → Email campaign
          </button>
        </div>
      ) : null}

      {(item.format === 'carousel' ||
        item.format === 'video_script' ||
        item.brief_json?.needs_visual === true) &&
      ['approved_internal', 'scheduled'].includes(item.status) ? (
        <>
          <label style={{ display: 'grid', gap: '0.25rem' }}>
            <span className="muted">Production phase</span>
            <select
              value={phase}
              disabled={!canProduction || saving}
              onChange={(e) => setPhase(e.target.value)}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem' }}
            >
              {PRODUCTION_PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <input
              value={designerId}
              onChange={(e) => setDesignerId(e.target.value)}
              placeholder="Designer staff id"
              style={{ width: 140, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem' }}
            />
            <input
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="Video staff id"
              style={{ width: 140, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem' }}
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Ghi chú production"
            disabled={!canProduction}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.45rem' }}
          />
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <input
              value={assetUrl}
              onChange={(e) => setAssetUrl(e.target.value)}
              placeholder="Asset URL"
              style={{ flex: 1, minWidth: 180, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem' }}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={!canProduction || !assetUrl.trim()}
              onClick={() => setAssetUrls([...assetUrls, assetUrl.trim()])}
            >
              + URL
            </button>
          </div>
          {assetUrls.length ? (
            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.82rem' }}>
              {assetUrls.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ul>
          ) : null}
          <input
            value={creativeId}
            onChange={(e) => setCreativeId(e.target.value)}
            placeholder="Creative id (paid ads)"
            disabled={!canProduction}
            style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.35rem' }}
          />
          {canProduction ? (
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={saving}
                onClick={() =>
                  void saveProduction({
                    phase,
                    assignee_designer_id: designerId ? Number(designerId) : null,
                    assignee_video_id: videoId ? Number(videoId) : null,
                    notes,
                    asset_urls: assetUrls,
                    creative_id: creativeId || null,
                  })
                }
              >
                Lưu production
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void downloadExport('brief')}>
                Export brief
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void downloadExport('brief_pdf')}>
                Export PDF
              </button>
              {item.format === 'video_script' ? (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => void downloadExport('script')}>
                  Export script
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await postContentOsProductionDone(token, lifecycleId, item.id);
                    onMessage('Production done — có thể publish');
                    onChanged();
                  } catch (err) {
                    onError(err instanceof Error ? err.message : 'Mark done thất bại');
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Mark production done
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
