'use client';

import { useState } from 'react';
import { ContentOsBriefSupplementModal } from '@/components/content-os/ContentOsBriefSupplementModal';
import {
  CmktApiError,
  parseCmktGateError,
  postContentOsDraftJob,
  postContentOsRegenerateJob,
  postContentOsVariantsJob,
  type ContentOsItem,
  type ContentOsJob,
} from '@/lib/content-os-api';

const REGEN_REASONS = ['Sai tone', 'Quá dài', 'Thiếu CTA', 'Chưa đúng factual'] as const;

interface Props {
  token: string;
  lifecycleId: number;
  itemId: number;
  item: ContentOsItem | null;
  aiEnabled: boolean;
  canGenerate: boolean;
  canWrite: boolean;
  piiConsent?: boolean;
  onJobDone: () => Promise<void> | void;
  onError: (msg: string) => void;
  onMessage: (msg: string) => void;
}

export function ContentOsGeneratePanel({
  token,
  lifecycleId,
  itemId,
  item,
  aiEnabled,
  canGenerate,
  canWrite,
  piiConsent = false,
  onJobDone,
  onError,
  onMessage,
}: Props) {
  const [tone, setTone] = useState('professional_friendly');
  const [length, setLength] = useState('medium');
  const [goal, setGoal] = useState('engagement');
  const [variantCount, setVariantCount] = useState(3);
  const [regenMode, setRegenMode] = useState<'rewrite' | 'refresh'>('rewrite');
  const [regenReason, setRegenReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastJob, setLastJob] = useState<ContentOsJob | null>(null);
  const [lastJobKind, setLastJobKind] = useState<'draft' | 'variants' | 'regenerate' | null>(null);
  const [briefModalOpen, setBriefModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<Array<'audience' | 'goal'>>([]);
  const [pendingKind, setPendingKind] = useState<'draft' | 'variants' | 'regenerate' | null>(null);

  const hasBody = Boolean(String(item?.body_json?.markdown ?? '').trim());

  function handleBriefIncomplete(err: unknown): boolean {
    if (err instanceof CmktApiError && err.code === 'brief_incomplete') {
      const fields = err.details?.missing_fields;
      setMissingFields(
        Array.isArray(fields)
          ? (fields.filter((f) => f === 'audience' || f === 'goal') as Array<'audience' | 'goal'>)
          : ['audience', 'goal'],
      );
      setBriefModalOpen(true);
      onError(parseCmktGateError(err));
      return true;
    }
    return false;
  }

  async function runJob(kind: 'draft' | 'variants' | 'regenerate') {
    if (!canGenerate || !aiEnabled) return;
    setBusy(true);
    onError('');
    setLastJobKind(kind);
    setPendingKind(null);
    try {
      const job =
        kind === 'draft'
          ? await postContentOsDraftJob(token, lifecycleId, itemId, {
              tone,
              length,
              goal,
              variant_count: variantCount,
            })
          : kind === 'variants'
            ? await postContentOsVariantsJob(token, lifecycleId, itemId, {
                tone,
                goal,
                variant_count: variantCount,
              })
            : await postContentOsRegenerateJob(token, lifecycleId, itemId, {
                mode: regenMode,
                reason: regenReason || undefined,
                tone,
                length,
                goal,
              });
      setLastJob(job);
      if (job.status === 'failed') {
        onError(job.error_text ?? 'AI job failed');
      } else {
        onMessage(
          kind === 'draft'
            ? `Draft OK — v${String(job.output_json?.version_no ?? '?')}`
            : kind === 'variants'
              ? `Variants OK — ${String(job.output_json?.variant_count ?? variantCount)} hooks`
              : `Regenerate OK — v${String(job.output_json?.version_no ?? '?')} (${regenMode})`,
        );
        await onJobDone();
      }
    } catch (err) {
      if (handleBriefIncomplete(err)) {
        setPendingKind(kind);
        setLastJob(null);
        return;
      }
      setLastJob(null);
      onError(parseCmktGateError(err));
    } finally {
      setBusy(false);
    }
  }

  if (!aiEnabled) {
    return <p className="muted" style={{ fontSize: '0.85rem' }}>AI tắt — bật PTT_CONTENT_MARKETING_AI_ENABLED.</p>;
  }

  return (
    <>
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '0.65rem',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        <strong style={{ fontSize: '0.9rem' }}>AI Generate</strong>
        {!piiConsent ? (
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>
            BR-CMKT-04: PII KH không đưa vào prompt (chưa có consent lifecycle).
          </p>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
            <span className="muted">Tone</span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              disabled={!canGenerate || busy}
              style={selectStyle}
            >
              <option value="professional_friendly">Professional friendly</option>
              <option value="bold">Bold</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
            <span className="muted">Length</span>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              disabled={!canGenerate || busy}
              style={selectStyle}
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </label>
          <label style={{ display: 'grid', gap: '0.2rem', fontSize: '0.82rem' }}>
            <span className="muted">Goal</span>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={!canGenerate || busy}
              style={selectStyle}
            >
              <option value="engagement">Engagement</option>
              <option value="lead">Lead</option>
              <option value="awareness">Awareness</option>
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
              <option value={3}>3</option>
              <option value={4}>4</option>
              <option value={5}>5</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!canGenerate || busy}
            onClick={() => void runJob('draft')}
          >
            {busy && lastJobKind === 'draft' ? 'Đang generate…' : 'Generate draft'}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={!canGenerate || busy}
            onClick={() => void runJob('variants')}
          >
            Generate variants
          </button>
        </div>

        {hasBody ? (
          <div
            style={{
              borderTop: '1px dashed var(--border)',
              paddingTop: '0.5rem',
              display: 'grid',
              gap: '0.45rem',
            }}
          >
            <strong style={{ fontSize: '0.85rem' }}>Regenerate / viết lại (UC-010)</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {REGEN_REASONS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  className={regenReason === chip ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
                  disabled={!canGenerate || busy}
                  onClick={() => setRegenReason(chip)}
                >
                  {chip}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: '0.35rem', fontSize: '0.82rem', alignItems: 'center' }}>
                <span className="muted">Mode</span>
                <select
                  value={regenMode}
                  onChange={(e) => setRegenMode(e.target.value as 'rewrite' | 'refresh')}
                  disabled={!canGenerate || busy}
                  style={selectStyle}
                >
                  <option value="rewrite">Rewrite</option>
                  <option value="refresh">Refresh</option>
                </select>
              </label>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={!canGenerate || busy}
                onClick={() => void runJob('regenerate')}
              >
                {busy && lastJobKind === 'regenerate' ? 'Đang viết lại…' : 'Yêu cầu viết lại'}
              </button>
            </div>
          </div>
        ) : null}

        {!canGenerate ? (
          <p className="muted" style={{ fontSize: '0.82rem' }}>Cần quyền crm_content.generate</p>
        ) : null}
        {lastJob?.status === 'failed' && lastJobKind ? (
          <div style={{ display: 'grid', gap: '0.35rem' }}>
            <p className="error" style={{ fontSize: '0.82rem', margin: 0 }}>
              Job #{lastJob.id} thất bại
              {lastJob.error_text ? ` — ${lastJob.error_text}` : ''}. Nội dung editor giữ nguyên.
            </p>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!canGenerate || busy}
              onClick={() => void runJob(lastJobKind)}
            >
              Thử lại
            </button>
          </div>
        ) : null}
        {lastJob?.status !== 'failed' && lastJob?.output_json?.fallback === true ? (
          <p style={{ fontSize: '0.82rem', color: 'var(--warning, #e6a700)', margin: 0 }}>
            Đang dùng template fallback — kiểm tra nội dung trước khi submit.
          </p>
        ) : null}
        {lastJob && lastJob.status !== 'failed' ? (
          <p className="muted" style={{ fontSize: '0.82rem' }}>
            Job #{lastJob.id} · {lastJob.job_type} · {lastJob.status}
          </p>
        ) : null}
      </div>

      <ContentOsBriefSupplementModal
        open={briefModalOpen}
        token={token}
        lifecycleId={lifecycleId}
        item={item}
        missingFields={missingFields}
        canWrite={canWrite}
        busy={busy}
        onClose={() => setBriefModalOpen(false)}
        onSaved={async () => {
          await onJobDone();
          if (pendingKind) {
            await runJob(pendingKind);
          }
        }}
        onMessage={onMessage}
        onError={onError}
      />
    </>
  );
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.35rem',
  color: 'var(--text)',
};
