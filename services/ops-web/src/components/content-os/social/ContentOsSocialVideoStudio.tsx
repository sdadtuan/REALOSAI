'use client';

import { useState } from 'react';
import {
  fetchContentOsJob,
  isVideoMediaAsset,
  itemNeedsVisualApproval,
  parseCmktGateError,
  patchContentOsMediaSelect,
  postContentOsEscalateHuman,
  postContentOsVideoShortJob,
  postContentOsVisualApprove,
  postContentOsVisualReject,
  postContentOsVisualSubmitReview,
  postSocialRender,
  postSocialStoryboard,
  visualStatusLabel,
  type ContentOsItem,
  type ContentOsJob,
  type ContentOsMediaAsset,
  type ContentOsVideoBeat,
} from '@/lib/content-os-api';
import { VIDEO_STUDIO_SOCIAL_LABEL } from '@/components/content-os/ContentOsVideoStudioPicker';

export const SOCIAL_VIDEO_PACKS = [
  { id: 'reels', label: 'Reels' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'feed_square', label: 'Feed 1:1' },
] as const;

export const SOCIAL_VIDEO_PROGRESS_STEPS = [
  'script',
  'beats',
  'tts',
  'clips',
  'storyboard',
  'compose',
  'qa',
  'packs',
] as const;

const STYLE_PRESETS = ['corporate', 'bold', 'minimal', 'playful'] as const;
const BEAT_IDS = ['hook', 'pain', 'proof', 'cta'] as const;
const VOICES = [
  { id: 'alloy', lang: 'vi' as const, label: 'VI · Alloy' },
  { id: 'nova', lang: 'vi' as const, label: 'VI · Nova' },
  { id: 'alloy', lang: 'en' as const, label: 'EN · Alloy' },
];

interface Props {
  token: string;
  lifecycleId: number;
  item: ContentOsItem;
  mediaEnabled: boolean;
  videoGenEnabled: boolean;
  canGenerate: boolean;
  canWrite: boolean;
  canApprove: boolean;
  canProduction: boolean;
  onChanged: () => Promise<void> | void;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ContentOsSocialVideoStudio({
  token,
  lifecycleId,
  item,
  mediaEnabled,
  videoGenEnabled,
  canGenerate,
  canWrite,
  canApprove,
  canProduction,
  onChanged,
  onMessage,
  onError,
}: Props) {
  const media = item.media_json ?? {};
  const storyboard = media.storyboard;
  const [packDefault, setPackDefault] = useState(storyboard?.pack_default ?? 'reels');
  const [stylePreset, setStylePreset] = useState(storyboard?.style_preset ?? 'corporate');
  const [voiceKey, setVoiceKey] = useState(
    `${storyboard?.voice?.lang ?? 'vi'}:${storyboard?.voice?.voice_id ?? 'alloy'}`,
  );
  const [busy, setBusy] = useState(false);
  const [lastJob, setLastJob] = useState<ContentOsJob | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [showReject, setShowReject] = useState(false);

  const copyReady = ['approved_internal', 'scheduled', 'client_approved'].includes(item.status);
  const assets: ContentOsMediaAsset[] = [
    ...(media.ai_assets ?? []),
    ...(media.video_short ? [media.video_short] : []),
    ...Object.values(media.video_packs ?? {}),
  ].filter((asset, idx, all) => all.findIndex((a) => a.id === asset.id) === idx);
  const preview = media.video_short ?? assets.find((a) => isVideoMediaAsset(a));
  const videoQa = media.video_qa;
  const steps = media.video_generation?.steps ?? {};
  const voice = VOICES.find((v) => `${v.lang}:${v.id}` === voiceKey) ?? VOICES[0];
  const beats = BEAT_IDS.map(
    (id) =>
      storyboard?.beats.find((b) => b.id === id) ??
      ({ id, script_excerpt: '', clip_id: null } satisfies ContentOsVideoBeat),
  );
  const generateBlocked = busy || !canGenerate || !mediaEnabled || !videoGenEnabled;
  const draftWatermark = item.status === 'draft' || item.visual_status !== 'approved';

  async function runJob(fn: () => Promise<ContentOsJob>, okMsg: string): Promise<void> {
    if (generateBlocked && !busy) return;
    if (!canGenerate || !mediaEnabled || !videoGenEnabled) return;
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
        onError(job.error_text ?? 'Video job failed');
      } else {
        onMessage(okMsg);
        await onChanged();
      }
    } catch (err) {
      onError(parseCmktGateError(err));
    } finally {
      setBusy(false);
    }
  }

  const jobBody = {
    pack_default: packDefault,
    requested_packs: [packDefault],
    style_preset: stylePreset,
    voice: { provider: 'openai', voice_id: voice.id, lang: voice.lang },
    allow_draft_watermark: draftWatermark,
  };

  return (
    <div style={{ display: 'grid', gap: '0.65rem', marginTop: '0.75rem' }}>
      <strong style={{ fontSize: '0.9rem' }}>Media AI Studio — {VIDEO_STUDIO_SOCIAL_LABEL}</strong>

      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
        <span className="badge">Copy: {copyReady ? `${item.status} ✓` : item.status}</span>
        <span className="badge">Visual: {visualStatusLabel(item.visual_status)}</span>
        {videoQa?.score != null ? <span className="badge">Video QA: {videoQa.score}/100</span> : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
          <span className="muted">Pack</span>
          <select
            value={packDefault}
            onChange={(e) => setPackDefault(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            {SOCIAL_VIDEO_PACKS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
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
          <span className="muted">Voice</span>
          <select
            value={voiceKey}
            onChange={(e) => setVoiceKey(e.target.value)}
            disabled={!canGenerate || busy}
            style={selectStyle}
          >
            {VOICES.map((v) => (
              <option key={`${v.lang}:${v.id}`} value={`${v.lang}:${v.id}`}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {canGenerate ? (
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={generateBlocked || (!copyReady && item.status !== 'draft')}
            title={videoGenEnabled ? 'Tạo 4 beat + TTS + clip id' : 'Bật PTT_CMKT_VIDEO_GEN=1'}
            onClick={() =>
              void runJob(
                () => postSocialStoryboard(token, lifecycleId, item.id, jobBody),
                'Đã tạo storyboard',
              )
            }
          >
            {busy ? 'Đang chạy…' : 'Tạo storyboard'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={generateBlocked || !storyboard || (!copyReady && item.status !== 'draft')}
            title={storyboard ? 'FFmpeg stitch master MP4' : 'Cần storyboard trước'}
            onClick={() =>
              void runJob(
                () => postSocialRender(token, lifecycleId, item.id, jobBody),
                'Đã render video',
              )
            }
          >
            Render video
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={generateBlocked || (!copyReady && item.status !== 'draft')}
            title="Tạo storyboard + render (one-shot)"
            onClick={() =>
              void runJob(
                () =>
                  postContentOsVideoShortJob(token, lifecycleId, item.id, {
                    pack_default: packDefault,
                    requested_packs: [packDefault],
                    aspect_ratio: packDefault === 'feed_square' ? '1:1' : '9:16',
                    style_preset: stylePreset,
                    allow_draft_watermark: draftWatermark,
                  }),
                'Đã tạo nhanh short video',
              )
            }
          >
            Tạo nhanh
          </button>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Cần quyền crm_content.generate
        </p>
      )}

      <div style={{ display: 'grid', gap: '0.4rem' }}>
        <strong style={{ fontSize: '0.85rem' }}>Beats</strong>
        {beats.map((beat) => (
          <div
            key={beat.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 1fr 140px',
              gap: '0.45rem',
              fontSize: '0.8rem',
              alignItems: 'start',
            }}
          >
            <span className="badge" style={{ textTransform: 'uppercase' }}>
              {beat.id}
            </span>
            <span>{beat.script_excerpt || '—'}</span>
            <span className="muted">clip: {beat.clip_id ?? '—'}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.82rem' }}>
          Progress
          {media.video_generation?.progress_pct != null
            ? ` · ${media.video_generation.progress_pct}%`
            : ''}
        </div>
        <p className="muted" style={{ fontSize: '0.75rem', margin: 0 }}>
          {SOCIAL_VIDEO_PROGRESS_STEPS.map((step) => {
            const state = steps[step] ?? 'pending';
            const mark = state === 'done' ? '✓' : state === 'running' ? '⟳' : state === 'failed' ? '✕' : '○';
            return `${step} ${mark}`;
          }).join(' · ')}
        </p>
      </div>

      {preview?.url ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <strong style={{ fontSize: '0.85rem' }}>Preview</strong>
          <video
            controls
            playsInline
            poster={preview.poster_url}
            src={preview.url}
            style={{ width: '100%', maxHeight: 360, borderRadius: 8, background: '#111' }}
          />
          <div className="muted" style={{ fontSize: '0.75rem' }}>
            {preview.duration_sec ?? storyboard?.tts?.duration_sec ?? '—'}s · {preview.provider}
            {preview.draft_watermark ? ' · DRAFT watermark' : ''}
          </div>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: '0.82rem' }}>
          Chưa có MP4 — tạo storyboard rồi Render video.
        </p>
      )}

      {assets.length ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={!canGenerate || busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    await patchContentOsMediaSelect(token, lifecycleId, item.id, asset.id);
                    onMessage('Đã chọn asset');
                    await onChanged();
                  } catch (err) {
                    onError(parseCmktGateError(err));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
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
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {videoQa ? (
        <div style={{ fontSize: '0.78rem', display: 'grid', gap: 4 }}>
          <div>
            Video QA score: <strong>{videoQa.score}</strong>
            {videoQa.blocked ? ' · blocked' : ''}
          </div>
          {videoQa.notes ? <div className="muted">{videoQa.notes}</div> : null}
          {videoQa.checks ? (
            <div className="muted">
              {Object.entries(videoQa.checks)
                .map(([k, ok]) => `${k.replace(/_/g, ' ')} ${ok ? '✓' : '○'}`)
                .join(' · ') || 'QA checks pending'}
            </div>
          ) : null}
        </div>
      ) : null}

      {itemNeedsVisualApproval(item) ? (
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
                  onError(parseCmktGateError(err));
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
                      override: videoQa?.score != null && videoQa.score < 50 ? true : undefined,
                    });
                    onMessage('Visual approved — có thể publish');
                    await onChanged();
                  } catch (err) {
                    onError(parseCmktGateError(err));
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
                    onError(parseCmktGateError(err));
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
      ) : null}

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
                onError(parseCmktGateError(err));
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
