'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  patchMktAiBrief,
  prefillMktAiBriefFromL1Consult,
  uploadMktAiBrief,
  type MktAiBrief,
  type MktAiBriefReadiness,
  type MktAiBriefValidation,
} from '@/lib/mkt-ai-planner-api';
import {
  BRIEF_REQUIRED_FIELD_ORDER,
  briefAutosaveSnapshot,
  formatBriefVnd,
  normalizeBriefForSave,
  parseBriefVnd,
} from '@/lib/mkt-ai-brief-fields';
import {
  formatIntakeAutosaveTime,
  useIntakeAutosave,
} from '@/lib/crm/use-intake-autosave';
import { BRIEF_FIELD_LABELS } from '@/lib/tmmt-labels';
import { AiPlaybookSelector } from '@/components/mkt-ai/AiPlaybookSelector';
import type { MktAiPlannerContext } from '@/lib/mkt-ai-planner-api';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
  width: '100%',
};

interface Props {
  token: string;
  lifecycleId: number;
  brief: MktAiBrief;
  onBriefChange: (brief: MktAiBrief) => void;
  briefValidation?: MktAiBriefValidation;
  prefillSources?: string[];
  serviceSlug?: string;
  canEdit: boolean;
  paused?: boolean;
  /** Bump when parent reloads context — resets autosave baseline. */
  resetAutosaveKey?: string | number;
  onPersisted: (result: {
    brief: MktAiBrief;
    brief_validation: MktAiBriefValidation;
    brief_readiness?: MktAiBriefReadiness;
  }) => void;
  onContinue: () => void;
  onSaveError?: (message: string) => void;
  playbooksEnabled?: boolean;
  playbookContext?: MktAiPlannerContext['playbook'];
  briefUploadEnabled?: boolean;
  briefReadiness?: MktAiBriefReadiness;
}

export function BriefIntakeForm({
  token,
  lifecycleId,
  brief,
  onBriefChange,
  briefValidation,
  prefillSources,
  serviceSlug,
  canEdit,
  paused = false,
  resetAutosaveKey,
  onPersisted,
  onContinue,
  onSaveError,
  playbooksEnabled = false,
  playbookContext,
  briefUploadEnabled = false,
  briefReadiness,
}: Props) {
  const fieldRefs = useRef<Partial<Record<string, HTMLElement | null>>>({});
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [prefillBusy, setPrefillBusy] = useState(false);

  const hasL1ConsultPrefill = prefillSources?.includes('l1-consult-bridge') ?? false;

  const snapshot = useMemo(
    () => briefAutosaveSnapshot(brief, serviceSlug),
    [brief, serviceSlug],
  );

  const persistBrief = useCallback(async () => {
    const out = await patchMktAiBrief(
      token,
      lifecycleId,
      normalizeBriefForSave(brief, serviceSlug),
    );
    onBriefChange(out.brief);
    onPersisted(out);
  }, [brief, lifecycleId, onBriefChange, onPersisted, serviceSlug, token]);

  const autosave = useIntakeAutosave({
    enabled: canEdit,
    paused,
    snapshot,
    onSave: persistBrief,
    debounceMs: 800,
  });

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    autosave.syncSnapshot(snapshotRef.current);
  }, [resetAutosaveKey, autosave.syncSnapshot]);

  const briefFieldErrors = useMemo(
    () => new Set(briefValidation?.missing ?? []),
    [briefValidation],
  );

  const scrollToFirstMissing = useCallback((missingKeys?: string[]) => {
    const missing = new Set(missingKeys ?? briefValidation?.missing ?? []);
    for (const key of BRIEF_REQUIRED_FIELD_ORDER) {
      if (!missing.has(key)) continue;
      const el = fieldRefs.current[key];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = el.querySelector<HTMLElement>(
          'input:not([disabled]), textarea:not([disabled])',
        );
        focusable?.focus();
      }
      break;
    }
  }, [briefValidation]);

  async function handleManualSave() {
    try {
      await persistBrief();
      autosave.markSavedNow(snapshot);
    } catch (err) {
      onSaveError?.(err instanceof Error ? err.message : 'Lưu brief thất bại');
    }
  }

  async function handleContinue() {
    if (!canEdit) {
      onContinue();
      return;
    }

    if (autosave.dirty || !briefValidation?.ok) {
      try {
        const out = await patchMktAiBrief(
          token,
          lifecycleId,
          normalizeBriefForSave(brief, serviceSlug),
        );
        onBriefChange(out.brief);
        onPersisted(out);
        autosave.markSavedNow(briefAutosaveSnapshot(out.brief, serviceSlug));
        if (!out.brief_validation.ok) {
          scrollToFirstMissing(out.brief_validation.missing);
          return;
        }
      } catch (err) {
        onSaveError?.(err instanceof Error ? err.message : 'Lưu brief thất bại');
        return;
      }
    }

    onContinue();
  }

  function bindFieldRef(key: string) {
    return (el: HTMLElement | null) => {
      fieldRefs.current[key] = el;
    };
  }

  const autosaveHint =
    autosave.status === 'pending'
      ? 'Đang chờ lưu…'
      : autosave.status === 'saving'
        ? 'Đang lưu brief…'
        : autosave.status === 'saved' && autosave.savedAt
          ? `Đã lưu ${formatIntakeAutosaveTime(autosave.savedAt)}`
          : autosave.status === 'error'
            ? 'Lưu tự động thất bại — bấm Lưu brief'
            : null;

  async function handleBriefUpload(file: File) {
    if (!canEdit || paused) return;
    setUploadBusy(true);
    try {
      const out = await uploadMktAiBrief(token, lifecycleId, file);
      onBriefChange(out.brief);
      onPersisted(out);
      autosave.markSavedNow(briefAutosaveSnapshot(out.brief, serviceSlug));
    } catch (err) {
      onSaveError?.(err instanceof Error ? err.message : 'Upload brief thất bại');
    } finally {
      setUploadBusy(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }

  const readinessLow =
    briefReadiness != null && briefReadiness.score < briefReadiness.low_threshold;

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: '1rem' }}>Thông tin dự án</h3>
        {canEdit && autosaveHint ? (
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {autosaveHint}
          </span>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Chỉ xem — cần quyền <code>crm_mkt_ai.generate</code> và stage onboard/deliver để chỉnh sửa brief.
        </p>
      ) : null}

      {(prefillSources?.length ?? 0) > 0 ? (
        <div
          style={{
            margin: 0,
            fontSize: '0.85rem',
            padding: '0.5rem 0.65rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'rgba(57, 139, 67, 0.04)',
            display: 'grid',
            gap: '0.45rem',
          }}
        >
          <p style={{ margin: 0 }}>
            {hasL1ConsultPrefill ? (
              <>
                <strong>Prefill TMMT (L1 + Consult)</strong>
                {briefReadiness != null ? (
                  <> — readiness {briefReadiness.score}/100 (mục tiêu ≥80%)</>
                ) : null}
              </>
            ) : (
              <>Đã nhập từ: {prefillSources!.join(' · ')}</>
            )}
          </p>
          {hasL1ConsultPrefill && canEdit ? (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm"
                disabled={prefillBusy}
                onClick={() => {
                  void (async () => {
                    setPrefillBusy(true);
                    try {
                      const out = await prefillMktAiBriefFromL1Consult(token, lifecycleId);
                      onBriefChange(out.brief);
                      onPersisted(out);
                      autosave.markSavedNow(briefAutosaveSnapshot(out.brief, serviceSlug));
                    } catch (err) {
                      onSaveError?.(
                        err instanceof Error ? err.message : 'Prefill L1 + Consult thất bại',
                      );
                    } finally {
                      setPrefillBusy(false);
                    }
                  })();
                }}
              >
                {prefillBusy ? 'Đang prefill…' : 'Áp dụng lại L1 + Consult'}
              </button>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Nguồn: {prefillSources!.join(' · ')}
            </p>
          )}
        </div>
      ) : null}

      {briefUploadEnabled ? (
        <div
          style={{
            display: 'grid',
            gap: '0.5rem',
            padding: '0.65rem',
            borderRadius: 8,
            border: '1px dashed var(--border)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Upload brief (PDF/DOCX/TXT)</span>
            {briefReadiness != null ? (
              <span
                style={{
                  fontSize: '0.85rem',
                  color: readinessLow ? 'var(--accent)' : 'var(--success, #398b43)',
                }}
              >
                Readiness {briefReadiness.score}/{briefReadiness.low_threshold}+
              </span>
            ) : null}
          </div>
          {readinessLow ? (
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              {briefReadiness?.messages[0] ?? 'Brief chưa đủ thông tin — bổ sung trước khi chạy pipeline AI.'}
            </p>
          ) : null}
          {canEdit ? (
            <>
              <input
                ref={uploadRef}
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,text/plain"
                disabled={paused || uploadBusy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleBriefUpload(f);
                }}
              />
              {uploadBusy ? (
                <span className="muted" style={{ fontSize: '0.85rem' }}>
                  Đang trích xuất brief…
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {playbooksEnabled ? (
        <AiPlaybookSelector
          token={token}
          lifecycleId={lifecycleId}
          serviceSlug={serviceSlug}
          canEdit={canEdit}
          paused={paused}
          activeSlug={playbookContext?.slug ?? null}
          onApplied={(out) => {
            onBriefChange(out.brief);
            onPersisted(out);
          }}
          onError={onSaveError}
        />
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '0.65rem',
        }}
      >
        {(['brand_name', 'industry', 'service_slug'] as const).map((key) => (
          <label
            key={key}
            ref={bindFieldRef(key)}
            style={{ display: 'grid', gap: '0.3rem' }}
          >
            <span className="muted">
              {BRIEF_FIELD_LABELS[key]}
              {briefFieldErrors.has(key) ? ' *' : ''}
            </span>
            <input
              style={{
                ...inputStyle,
                borderColor: briefFieldErrors.has(key) ? 'var(--accent)' : undefined,
              }}
              value={String(brief[key] ?? (key === 'service_slug' ? serviceSlug ?? '' : ''))}
              disabled={!canEdit || paused || key === 'service_slug'}
              onChange={(e) => onBriefChange({ ...brief, [key]: e.target.value })}
              onBlur={() => autosave.saveOnBlur()}
            />
          </label>
        ))}

        <label ref={bindFieldRef('budget_monthly_vnd')} style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="muted">
            {BRIEF_FIELD_LABELS.budget_monthly_vnd}
            {briefFieldErrors.has('budget_monthly_vnd') ? ' *' : ''}
          </span>
          <input
            style={{
              ...inputStyle,
              borderColor: briefFieldErrors.has('budget_monthly_vnd') ? 'var(--accent)' : undefined,
            }}
            value={formatBriefVnd(brief.budget_monthly_vnd)}
            disabled={!canEdit || paused}
            onChange={(e) =>
              onBriefChange({ ...brief, budget_monthly_vnd: parseBriefVnd(e.target.value) })
            }
            onBlur={() => autosave.saveOnBlur()}
          />
        </label>

        <div
          ref={bindFieldRef('objective')}
          style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}
        >
          <span className="muted">
            {BRIEF_FIELD_LABELS.objective}
            {briefFieldErrors.has('objective') ? ' *' : ''}
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {(['lead', 'awareness', 'sales', 'retention'] as const).map((obj) => (
              <label key={obj} style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <input
                  type="radio"
                  name="mkt-ai-objective"
                  checked={(brief.objective ?? 'lead') === obj}
                  disabled={!canEdit || paused}
                  onChange={() => onBriefChange({ ...brief, objective: obj })}
                  onBlur={() => autosave.saveOnBlur()}
                />
                {obj}
              </label>
            ))}
          </div>
        </div>

        <label ref={bindFieldRef('geo_markets')} style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="muted">
            {BRIEF_FIELD_LABELS.geo_markets}
            {briefFieldErrors.has('geo_markets') ? ' *' : ''}
          </span>
          <input
            style={{
              ...inputStyle,
              borderColor: briefFieldErrors.has('geo_markets') ? 'var(--accent)' : undefined,
            }}
            value={(brief.geo_markets ?? []).join(', ')}
            disabled={!canEdit || paused}
            onChange={(e) =>
              onBriefChange({
                ...brief,
                geo_markets: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              })
            }
            onBlur={() => autosave.saveOnBlur()}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem' }}>
          <span className="muted">{BRIEF_FIELD_LABELS.competitors}</span>
          <input
            style={inputStyle}
            value={(brief.competitors ?? []).join(', ')}
            disabled={!canEdit || paused}
            onChange={(e) =>
              onBriefChange({
                ...brief,
                competitors: e.target.value.split(',').map((x) => x.trim()).filter(Boolean),
              })
            }
            onBlur={() => autosave.saveOnBlur()}
          />
        </label>

        <label ref={bindFieldRef('challenges')} style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
          <span className="muted">
            {BRIEF_FIELD_LABELS.challenges}
            {briefFieldErrors.has('challenges') ? ' *' : ''}
          </span>
          <textarea
            rows={3}
            style={{
              ...inputStyle,
              borderColor: briefFieldErrors.has('challenges') ? 'var(--accent)' : undefined,
            }}
            value={brief.challenges ?? ''}
            disabled={!canEdit || paused}
            onChange={(e) => onBriefChange({ ...brief, challenges: e.target.value })}
            onBlur={() => autosave.saveOnBlur()}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.3rem', gridColumn: '1 / -1' }}>
          <span className="muted">{BRIEF_FIELD_LABELS.usp}</span>
          <textarea
            rows={2}
            style={inputStyle}
            value={brief.usp ?? ''}
            disabled={!canEdit || paused}
            onChange={(e) => onBriefChange({ ...brief, usp: e.target.value })}
            onBlur={() => autosave.saveOnBlur()}
          />
        </label>
      </div>

      {!briefValidation?.ok ? (
        <ul className="error" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
          {briefValidation?.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={paused || autosave.status === 'saving'}
            onClick={() => void handleManualSave()}
          >
            Lưu brief
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          onClick={() => void handleContinue()}
        >
          Tiếp → Strategy
        </button>
      </div>
    </div>
  );
}
