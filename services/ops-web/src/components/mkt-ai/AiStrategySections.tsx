'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DraftAutosaveHint } from '@/components/mkt-ai/DraftAutosaveHint';
import { MktAiDisabledHint } from '@/components/mkt-ai/MktAiDisabledHint';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
import {
  STRATEGY_FIELD_ORDER,
  strategyDraftSnapshot,
  TMMT_CORE_KEYS,
  TMMT_PROF_FIELD_ORDER,
} from '@/lib/mkt-ai-draft-fields';
import { AiSectionCommentThread } from '@/components/mkt-ai/AiSectionCommentThread';
import { patchMktAiDraft, postMktAiCompetitorSnapshotJob, type MktAiCitation, type MktAiCompetitorSnapshot, type MktAiDraft, type MktAiSectionCommentRow } from '@/lib/mkt-ai-planner-api';
import { STRATEGY_LABELS, TMMT_PROF_LABELS } from '@/lib/tmmt-labels';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';

const textareaStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.55rem 0.75rem',
  color: 'var(--text)',
  width: '100%',
  minHeight: '4.5rem',
  resize: 'vertical',
  fontSize: '0.85rem',
  lineHeight: 1.45,
};

interface Props {
  token: string;
  lifecycleId: number;
  strategyFramework: Record<string, string>;
  targetMarketProf: Record<string, string>;
  swotJson: Record<string, unknown>;
  ragCitations?: Record<string, MktAiCitation[]>;
  canEdit: boolean;
  paused?: boolean;
  resetAutosaveKey?: string | number;
  briefReady?: boolean;
  qualityScore?: number;
  onGenerate?: () => void;
  onRetry?: () => void;
  onDraftPersisted: (draft: MktAiDraft) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveError?: (message: string) => void;
  onContinue?: () => void;
  sectionCommentsEnabled?: boolean;
  sectionComments?: MktAiSectionCommentRow[];
  onSectionCommentAdded?: (row: MktAiSectionCommentRow) => void;
  competitorSnapshotEnabled?: boolean;
  competitorSnapshot?: MktAiCompetitorSnapshot | null;
  onCompetitorSnapshotUpdated?: (snapshot: MktAiCompetitorSnapshot) => void;
}

function swotLists(swot: Record<string, unknown>): Record<string, string[]> {
  const pick = (k: string) =>
    Array.isArray(swot[k])
      ? (swot[k] as unknown[]).map((x) => String(x)).filter(Boolean)
      : [];
  return {
    strengths: pick('strengths'),
    weaknesses: pick('weaknesses'),
    opportunities: pick('opportunities'),
    threats: pick('threats'),
  };
}

export function AiStrategySections({
  token,
  lifecycleId,
  strategyFramework,
  targetMarketProf,
  swotJson,
  ragCitations = {},
  canEdit,
  paused = false,
  resetAutosaveKey,
  briefReady = false,
  qualityScore,
  onGenerate,
  onRetry,
  onDraftPersisted,
  onDirtyChange,
  onSaveError,
  onContinue,
  sectionCommentsEnabled = false,
  sectionComments = [],
  onSectionCommentAdded,
  competitorSnapshotEnabled = false,
  competitorSnapshot = null,
  onCompetitorSnapshotUpdated,
}: Props) {
  const [sf, setSf] = useState(strategyFramework);
  const [prof, setProf] = useState(targetMarketProf);
  const [snapshotBusy, setSnapshotBusy] = useState(false);

  useEffect(() => {
    setSf(strategyFramework);
    setProf(targetMarketProf);
  }, [strategyFramework, targetMarketProf, resetAutosaveKey]);

  const snapshot = useMemo(() => strategyDraftSnapshot(sf, prof), [sf, prof]);

  const persistDraft = useCallback(async () => {
    const draft = await patchMktAiDraft(token, lifecycleId, {
      strategy_framework: sf,
      target_market_prof: prof,
    });
    onDraftPersisted(draft);
  }, [lifecycleId, onDraftPersisted, prof, sf, token]);

  const autosave = useIntakeAutosave({
    enabled: canEdit,
    paused,
    snapshot,
    onSave: persistDraft,
    debounceMs: 1000,
  });

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    autosave.syncSnapshot(snapshotRef.current);
  }, [resetAutosaveKey, autosave.syncSnapshot]);

  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  const hasContent =
    Object.values(sf).some((v) => String(v).trim()) ||
    Object.values(prof).some((v) => String(v).trim());

  const swot = swotLists(swotJson);

  function citationChips(sectionKey: string) {
    const cites = ragCitations[sectionKey] ?? [];
    if (!cites.length) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
        {cites.map((c) => (
          <span
            key={`${sectionKey}-${c.chunk_id}-${c.page_no ?? 'na'}`}
            className={styles.citationChip}
            title={c.excerpt ?? c.filename}
          >
            📎 {c.filename}
            {c.page_no != null ? ` p.${c.page_no}` : ''}
          </span>
        ))}
      </div>
    );
  }

  async function flushAndContinue() {
    if (!canEdit) {
      onContinue?.();
      return;
    }
    if (autosave.dirty) {
      try {
        await persistDraft();
        autosave.markSavedNow(snapshot);
      } catch (err) {
        onSaveError?.(err instanceof Error ? err.message : 'Lưu draft thất bại');
        return;
      }
    }
    onContinue?.();
  }

  function handleRetry() {
    if (autosave.dirty) {
      const ok = window.confirm(
        'Bạn đã chỉnh sửa draft thủ công. Sinh lại sẽ ghi đè phần chiến lược từ AI. Tiếp tục?',
      );
      if (!ok) return;
    }
    onRetry?.();
  }

  async function regenerateCompetitorSnapshot() {
    if (!canEdit || snapshotBusy) return;
    setSnapshotBusy(true);
    try {
      const out = await postMktAiCompetitorSnapshotJob(token, lifecycleId);
      const snap = out.output?.competitor_snapshot;
      if (snap) onCompetitorSnapshotUpdated?.(snap);
    } catch (err) {
      onSaveError?.(err instanceof Error ? err.message : 'Sinh lại competitor snapshot thất bại');
    } finally {
      setSnapshotBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {canEdit ? (
          <>
            <MktAiDisabledHint
              disabled={paused || !briefReady}
              title={!briefReady ? 'Hoàn thiện brief bước 1 trước khi sinh chiến lược' : 'Đang xử lý job khác'}
            >
              <button
                type="button"
                className="btn btn-sm"
                disabled={paused || !briefReady}
                onClick={() => onGenerate?.()}
              >
                Sinh chiến lược AI
              </button>
            </MktAiDisabledHint>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={paused}
              onClick={() => handleRetry()}
            >
              Sinh lại ↻
            </button>
          </>
        ) : (
          <span className="muted" style={{ fontSize: '0.85rem' }} title="Cần quyền crm_mkt_ai.generate và stage onboard/deliver">
            Chỉ xem — không có quyền sinh AI
          </span>
        )}
        {qualityScore != null ? (
          <span className="muted">
            Chất lượng: <strong>{qualityScore}/100</strong>
          </span>
        ) : null}
        {canEdit ? (
          <DraftAutosaveHint
            status={autosave.status}
            savedAt={autosave.savedAt}
            dirty={autosave.dirty}
            entityLabel="chiến lược"
          />
        ) : null}
      </div>

      {!hasContent ? (
        <p className="muted" style={{ margin: 0 }}>
          Hoàn thiện Brief rồi bấm Sinh chiến lược AI
        </p>
      ) : (
        <>
          <section>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Khung chiến lược</h4>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {STRATEGY_FIELD_ORDER.map((key) => (
                <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {STRATEGY_LABELS[key] ?? key}
                  </span>
                  {citationChips(key)}
                  {canEdit ? (
                    <textarea
                      style={textareaStyle}
                      value={sf[key] ?? ''}
                      onChange={(e) => setSf((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {sf[key] || '—'}
                    </div>
                  )}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>TMMT chi tiết (draft)</h4>
            <div style={{ display: 'grid', gap: '0.65rem' }}>
              {TMMT_PROF_FIELD_ORDER.map((key) => (
                <label key={key} style={{ display: 'grid', gap: '0.3rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    {TMMT_PROF_LABELS[key] ?? key}
                    {TMMT_CORE_KEYS.has(key) ? ' *' : ''}
                  </span>
                  {citationChips(key)}
                  {canEdit ? (
                    <textarea
                      style={textareaStyle}
                      value={prof[key] ?? ''}
                      onChange={(e) => setProf((prev) => ({ ...prev, [key]: e.target.value }))}
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  ) : (
                    <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {prof[key] || '—'}
                    </div>
                  )}
                  {sectionCommentsEnabled && key === 'segmentation_icp' ? (
                    <AiSectionCommentThread
                      token={token}
                      lifecycleId={lifecycleId}
                      sectionKey="segmentation_icp"
                      sectionLabel="ICP / Segmentation"
                      canEdit={canEdit}
                      paused={paused}
                      comments={sectionComments}
                      onCommentAdded={(row) => onSectionCommentAdded?.(row)}
                      onError={onSaveError}
                    />
                  ) : null}
                </label>
              ))}
            </div>
          </section>

          {(swot.strengths.length ||
            swot.weaknesses.length ||
            swot.opportunities.length ||
            swot.threats.length) > 0 ? (
            <section>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>SWOT (AI — chỉ đọc)</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                {(
                  [
                    ['Strengths', swot.strengths],
                    ['Weaknesses', swot.weaknesses],
                    ['Opportunities', swot.opportunities],
                    ['Threats', swot.threats],
                  ] as const
                ).map(([title, items]) => (
                  <div key={title} className="card" style={{ padding: '0.65rem 0.75rem' }}>
                    <div className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      {title}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {competitorSnapshotEnabled ? (
            <section className={styles.competitorSnapshotCard}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Competitor snapshot</h4>
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    disabled={paused || snapshotBusy}
                    onClick={() => void regenerateCompetitorSnapshot()}
                  >
                    {snapshotBusy ? 'Đang sinh…' : 'Sinh lại ↻'}
                  </button>
                ) : null}
              </div>
              {!competitorSnapshot?.competitors?.length ? (
                <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                  Thêm đối thủ trong Brief rồi bấm Sinh lại để tạo snapshot.
                </p>
              ) : (
                <>
                  {competitorSnapshot.summary_vi ? (
                    <p style={{ margin: '0.5rem 0', fontSize: '0.85rem' }}>{competitorSnapshot.summary_vi}</p>
                  ) : null}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.5rem',
                      marginTop: '0.5rem',
                    }}
                  >
                    {competitorSnapshot.competitors.map((c) => (
                      <div key={c.name} className="card" style={{ padding: '0.65rem 0.75rem', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                          <strong>{c.name}</strong>
                          {c.threat_level ? (
                            <span className="muted" style={{ fontSize: '0.75rem' }}>{c.threat_level}</span>
                          ) : null}
                        </div>
                        {c.positioning ? (
                          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.8rem' }}>{c.positioning}</p>
                        ) : null}
                        {c.channels?.length ? (
                          <p className="muted" style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }}>
                            Kênh: {c.channels.join(', ')}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.75rem' }}>
                    Cập nhật: {new Date(competitorSnapshot.generated_at).toLocaleString('vi-VN')}
                  </p>
                </>
              )}
            </section>
          ) : null}
        </>
      )}

      {onContinue ? (
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void flushAndContinue()}>
          Tiếp → Campaign
        </button>
      ) : null}
    </div>
  );
}
