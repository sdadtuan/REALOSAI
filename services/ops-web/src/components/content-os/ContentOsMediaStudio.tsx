'use client';

import { useState } from 'react';
import {
  VIDEO_STUDIO_SOP_HUB,
  ContentOsVideoStudioPicker,
} from '@/components/content-os/ContentOsVideoStudioPicker';
import { ContentOsSocialVideoStudio } from '@/components/content-os/social/ContentOsSocialVideoStudio';
import {
  fetchContentOsJob,
  isVideoMediaAsset,
  itemIsVideoStudioEligible,
  itemNeedsVisualApproval,
  patchContentOsMediaSelect,
  postContentOsCarouselSlidesJob,
  postContentOsEscalateHuman,
  postContentOsImageGenerateJob,
  postContentOsVisualApprove,
  postContentOsVisualQaJob,
  postContentOsVisualReject,
  postContentOsVisualSubmitReview,
  visualStatusLabel,
  type ContentOsItem,
  type ContentOsJob,
  type ContentOsMediaAsset,
  type ContentOsVideoStudio,
} from '@/lib/content-os-api';

const STYLE_PRESETS = ['corporate', 'bold', 'minimal', 'playful'] as const;
const ASPECT_RATIOS = ['1:1', '4:5', '9:16', '16:9'] as const;

interface Props {
  token: string;
  lifecycleId: number;
  item: ContentOsItem;
  mediaEnabled: boolean;
  imageGenEnabled: boolean;
  videoGenEnabled: boolean;
  canGenerate: boolean;
  canWrite: boolean;
  canApprove: boolean;
  canProduction: boolean;
  onChanged: () => Promise<void> | void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsMediaStudio({
  token,
  lifecycleId,
  item,
  mediaEnabled,
  imageGenEnabled,
  videoGenEnabled,
  canGenerate,
  canWrite,
  canApprove,
  canProduction,
  onChanged,
  onMessage,
  onError,
}: Props) {
  const [stylePreset, setStylePreset] = useState('corporate');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [variantCount, setVariantCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [lastJob, setLastJob] = useState<ContentOsJob | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [studioOverride, setStudioOverride] = useState<ContentOsVideoStudio | null>(null);

  const needsVisual = itemNeedsVisualApproval(item);
  const isVideoItem = itemIsVideoStudioEligible(item);
  const media = item.media_json ?? {};
  const assets: ContentOsMediaAsset[] = [
    ...(media.ai_assets ?? []),
    ...(media.carousel_slides ?? []),
    ...(media.video_short ? [media.video_short] : []),
  ];
  const qa = media.visual_qa;
  const copyReady = ['approved_internal', 'scheduled', 'client_approved'].includes(item.status);

  async function runJob(fn: () => Promise<ContentOsJob>, okMsg: string): Promise<void> {
    if (!canGenerate || !mediaEnabled || !imageGenEnabled) return;
    setBusy(true);
    onError('');
    try {
      let job = await fn();
      if (job.status === 'queued' || job.status === 'running') {
        for (let attempt = 0; attempt < 60; attempt++) {
          job = await fetchContentOsJob(token, lifecycleId, job.id);
          if (job.status === 'succeeded' || job.status === 'failed') break;
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
      setLastJob(job);
      if (job.status === 'failed') {
        onError(job.error_text ?? 'Media job failed');
      } else {
        onMessage(okMsg);
        await onChanged();
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Media job thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function selectAsset(assetId: string) {
    if (!canGenerate) return;
    setBusy(true);
    try {
      await patchContentOsMediaSelect(token, lifecycleId, item.id, assetId);
      onMessage('Đã chọn asset');
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chọn asset thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!needsVisual) {
    return (
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
        Item này không cần visual approval (text-only).
      </p>
    );
  }

  if (!mediaEnabled) {
    return (
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
        Media AI tắt — bật PTT_CONTENT_MARKETING_MEDIA_ENABLED=1.
      </p>
    );
  }

  if (isVideoItem) {
    const videoStudio = media.video_studio ?? studioOverride;
    if (!videoStudio) {
      return (
        <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.75rem' }}>
          <strong style={{ fontSize: '0.9rem' }}>Media AI Studio</strong>
          <ContentOsVideoStudioPicker
            token={token}
            lifecycleId={lifecycleId}
            itemId={item.id}
            disabled={!canGenerate}
            onSelect={async (studio) => {
              if (studio === 'cinematic') {
                setStudioOverride('cinematic');
                return;
              }
              await onChanged();
            }}
            onError={onError}
            onMessage={onMessage}
          />
        </div>
      );
    }
    if (videoStudio === 'social') {
      return (
        <ContentOsSocialVideoStudio
          token={token}
          lifecycleId={lifecycleId}
          item={item}
          mediaEnabled={mediaEnabled}
          videoGenEnabled={videoGenEnabled}
          canGenerate={canGenerate}
          canWrite={canWrite}
          canApprove={canApprove}
          canProduction={canProduction}
          onChanged={onChanged}
          onMessage={onMessage}
          onError={onError}
        />
      );
    }
    return (
      <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
        <strong style={{ fontSize: '0.9rem' }}>Media AI Studio</strong>
        <p style={{ fontSize: '0.85rem', margin: 0 }}>
          Mở Video SOP <code>{VIDEO_STUDIO_SOP_HUB}</code> (Module 7 — chưa ship thì disabled + link spec)
        </p>
        <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
          Spec: docs/superpowers/specs/2026-08-20-video-sop-module-7-design.md — không mở form beat tại đây.
        </p>
      </div>
    );
  }

  if (!imageGenEnabled) {
    return (
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
        Media AI tắt — bật PTT_CONTENT_MARKETING_MEDIA_ENABLED=1 và PTT_CMKT_IMAGE_GEN=1.
      </p>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.75rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Media AI Studio</strong>

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
        <span className="badge">
          Copy: {copyReady ? `${item.status} ✓` : item.status}
        </span>
        <span className="badge">Visual: {visualStatusLabel(item.visual_status)}</span>
        {qa?.score != null ? <span className="badge">QA: {qa.score}/100</span> : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Preset</span>
          <select
            value={stylePreset}
            onChange={(e) => setStylePreset(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            {STYLE_PRESETS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Size</span>
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            {ASPECT_RATIOS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Variants</span>
          <select
            value={variantCount}
            onChange={(e) => setVariantCount(Number(e.target.value))}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={4}>4</option>
          </select>
        </label>
      </div>

      {canGenerate ? (
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy || (!copyReady && item.status !== 'draft')}
            onClick={() =>
              void runJob(
                () =>
                  postContentOsImageGenerateJob(token, lifecycleId, item.id, {
                    variant_count: variantCount,
                    aspect_ratio: aspectRatio,
                    style_preset: stylePreset,
                    use_approved_copy_overlay: true,
                    allow_draft_watermark: item.status === 'draft',
                  }),
                'Đã generate image variants',
              )
            }
          >
            {busy ? 'Đang chạy…' : 'Generate image variants'}
          </button>
          {item.format === 'carousel' ? (
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy || (!copyReady && item.status !== 'draft')}
              onClick={() =>
                void runJob(
                  () =>
                    postContentOsCarouselSlidesJob(token, lifecycleId, item.id, {
                      aspect_ratio: aspectRatio,
                      style_preset: stylePreset,
                      allow_draft_watermark: item.status === 'draft',
                    }),
                  'Đã generate carousel slides',
                )
              }
            >
              Generate carousel slides
            </button>
          ) : null}
          {assets.length ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={() =>
                void runJob(
                  () => postContentOsVisualQaJob(token, lifecycleId, item.id),
                  'Visual QA đã chạy',
                )
              }
            >
              Run visual QA
            </button>
          ) : null}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem' }}>Cần quyền crm_content.generate</p>
      )}

      {assets.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={!canGenerate || busy}
              onClick={() => void selectAsset(asset.id)}
              style={{
                border:
                  asset.selected || media.selected_asset_id === asset.id
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',
                borderRadius: 8,
                padding: 4,
                background: 'var(--bg)',
                cursor: canGenerate ? 'pointer' : 'default',
                textAlign: 'left',
              }}
            >
              {isVideoMediaAsset(asset) ? (
                <video
                  controls
                  playsInline
                  poster={asset.poster_url}
                  src={asset.url}
                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6, background: '#111' }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.url}
                  alt={asset.type}
                  style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 6 }}
                />
              )}
              <div className="muted" style={{ fontSize: '0.72rem', marginTop: 4 }}>
                {asset.draft_watermark ? 'DRAFT' : asset.type}
                {asset.visual_qa_score != null ? ` · ${asset.visual_qa_score}` : ''}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem' }}>Chưa có preview — generate image hoặc carousel slides.</p>
      )}

      {media.video_short?.url ? (
        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.82rem' }}>
          <strong>Short video preview</strong>
          <div className="muted" style={{ fontSize: '0.75rem' }}>
            {media.video_short.duration_sec ?? 45}s · {media.video_short.provider}
          </div>
          <video
            controls
            playsInline
            poster={media.video_short.poster_url}
            src={media.video_short.url}
            style={{ width: '100%', maxHeight: 280, borderRadius: 8, background: '#111' }}
          />
          {media.video_short.draft_watermark ? (
            <span className="muted" style={{ fontSize: '0.75rem' }}>
              DRAFT watermark — clean sau visual approve
            </span>
          ) : null}
        </div>
      ) : null}

      {qa ? (
        <div style={{ fontSize: '0.78rem', display: 'grid', gap: 4 }}>
          <div>
            Visual QA score: <strong>{qa.score}</strong>
            {qa.blocked ? ' · blocked' : ''}
          </div>
          {qa.brand_delta_e_max != null ? (
            <div className="muted">Brand ΔE max: {qa.brand_delta_e_max}</div>
          ) : null}
          {qa.ocr_confidence != null ? (
            <div className="muted">OCR confidence: {Math.round(qa.ocr_confidence * 100)}%</div>
          ) : null}
          {qa.checks ? (
            <div className="muted">
              {Object.entries(qa.checks)
                .filter(([, ok]) => ok)
                .map(([k]) => k.replace(/_/g, ' '))
                .join(' · ') || 'QA checks pending'}
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
        {canWrite &&
        ['ai_ready', 'rejected'].includes(item.visual_status ?? '') &&
        assets.length ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await postContentOsVisualSubmitReview(token, lifecycleId, item.id);
                onMessage('Đã submit visual review');
                await onChanged();
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Submit visual thất bại');
              } finally {
                setBusy(false);
              }
            }}
          >
            Submit visual review
          </button>
        ) : null}

        {canApprove && ['ai_ready', 'human_polish'].includes(item.visual_status ?? '') ? (
          <>
            <input
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Comment (optional)"
              style={inputStyle}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await postContentOsVisualApprove(token, lifecycleId, item.id, {
                    comment: approveComment.trim() || undefined,
                    override: qa?.score != null && qa.score < 50 ? true : undefined,
                  });
                  onMessage('Visual approved — có thể publish');
                  await onChanged();
                } catch (err) {
                  onError(err instanceof Error ? err.message : 'Duyệt visual thất bại');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Duyệt visual
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => setShowReject((v) => !v)}
            >
              Từ chối visual
            </button>
          </>
        ) : null}

        {canProduction && ['ai_ready', 'rejected'].includes(item.visual_status ?? '') ? (
          <>
            <input
              value={escalateNotes}
              onChange={(e) => setEscalateNotes(e.target.value)}
              placeholder="Ghi chú escalate design"
              style={inputStyle}
            />
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await postContentOsEscalateHuman(token, lifecycleId, item.id, {
                    notes: escalateNotes.trim() || undefined,
                  });
                  onMessage('Đã escalate sang Design/Video');
                  await onChanged();
                } catch (err) {
                  onError(err instanceof Error ? err.message : 'Escalate thất bại');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Escalate to Design
            </button>
          </>
        ) : null}
      </div>

      {showReject ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canApprove || rejectComment.trim().length < 10) return;
            void (async () => {
              setBusy(true);
              try {
                await postContentOsVisualReject(token, lifecycleId, item.id, rejectComment.trim());
                onMessage('Đã từ chối visual');
                setShowReject(false);
                setRejectComment('');
                await onChanged();
              } catch (err) {
                onError(err instanceof Error ? err.message : 'Từ chối visual thất bại');
              } finally {
                setBusy(false);
              }
            })();
          }}
          style={{ display: 'grid', gap: '0.45rem' }}
        >
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            rows={2}
            placeholder="Lý do từ chối (≥10 ký tự)…"
            required
            minLength={10}
            style={{ ...inputStyle, width: '100%' }}
          />
          <button type="submit" className="btn btn-sm" disabled={busy || rejectComment.trim().length < 10}>
            Xác nhận từ chối
          </button>
        </form>
      ) : null}

      {lastJob ? (
        <p className="muted" style={{ fontSize: '0.78rem' }}>
          Job #{lastJob.id} · {lastJob.job_type} · {lastJob.status}
        </p>
      ) : null}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem',
  color: 'var(--text)',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem 0.5rem',
  color: 'var(--text)',
};
