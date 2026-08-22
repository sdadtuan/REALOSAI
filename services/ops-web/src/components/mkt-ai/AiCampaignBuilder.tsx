'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DraftAutosaveHint } from '@/components/mkt-ai/DraftAutosaveHint';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
import {
  campaignsDraftSnapshot,
  emptyCampaign,
  formatListField,
  parseListField,
} from '@/lib/mkt-ai-draft-fields';
import {
  patchMktAiDraft,
  type MktAiCampaignDraft,
  type MktAiDraft,
} from '@/lib/mkt-ai-planner-api';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.45rem 0.65rem',
  color: 'var(--text)',
  width: '100%',
  fontSize: '0.85rem',
};

interface Props {
  token: string;
  lifecycleId: number;
  campaigns: MktAiCampaignDraft[];
  canEdit: boolean;
  paused?: boolean;
  resetAutosaveKey?: string | number;
  hasStrategy?: boolean;
  defaultObjective?: string;
  onGenerate?: () => void;
  onDraftPersisted: (draft: MktAiDraft) => void;
  onSaveError?: (message: string) => void;
  onContinue?: () => void;
}

export function AiCampaignBuilder({
  token,
  lifecycleId,
  campaigns: initialCampaigns,
  canEdit,
  paused = false,
  resetAutosaveKey,
  hasStrategy = false,
  defaultObjective = 'lead',
  onGenerate,
  onDraftPersisted,
  onSaveError,
  onContinue,
}: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  useEffect(() => {
    setCampaigns(initialCampaigns);
  }, [initialCampaigns, resetAutosaveKey]);

  const snapshot = useMemo(() => campaignsDraftSnapshot(campaigns), [campaigns]);

  const persistDraft = useCallback(async () => {
    const draft = await patchMktAiDraft(token, lifecycleId, { campaigns_json: campaigns });
    onDraftPersisted(draft);
  }, [campaigns, lifecycleId, onDraftPersisted, token]);

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

  function updateCampaign(index: number, patch: Partial<MktAiCampaignDraft>) {
    setCampaigns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function removeCampaign(index: number) {
    if (!window.confirm('Xóa campaign này khỏi draft?')) return;
    setCampaigns((prev) => prev.filter((_, i) => i !== index));
  }

  function addCampaign() {
    setCampaigns((prev) => [...prev, emptyCampaign(defaultObjective)]);
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

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {canEdit ? (
          <>
            <button
              type="button"
              className="btn btn-sm"
              disabled={paused || !hasStrategy}
              onClick={() => onGenerate?.()}
            >
              Sinh campaign AI
            </button>
            <button type="button" className="btn btn-sm btn-secondary" disabled={paused} onClick={addCampaign}>
              + Thêm campaign thủ công
            </button>
          </>
        ) : null}
        {canEdit ? (
          <DraftAutosaveHint
            status={autosave.status}
            savedAt={autosave.savedAt}
            dirty={autosave.dirty}
            entityLabel="campaign"
          />
        ) : null}
      </div>

      {campaigns.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          Chưa có campaign — sinh từ bước Strategy hoặc thêm thủ công.
        </p>
      ) : (
        campaigns.map((c, index) => (
          <div
            key={`${c.name}-${index}`}
            className="card"
            style={{ padding: '0.85rem', border: '1px solid var(--border)', display: 'grid', gap: '0.55rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: '0.95rem' }}>Campaign {index + 1}</strong>
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={paused}
                  onClick={() => removeCampaign(index)}
                >
                  Xóa
                </button>
              ) : null}
            </div>

            {canEdit ? (
              <>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Tên
                  </span>
                  <input
                    style={inputStyle}
                    value={c.name}
                    onChange={(e) => updateCampaign(index, { name: e.target.value })}
                    onBlur={() => autosave.saveOnBlur()}
                  />
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.5rem',
                  }}
                >
                  <label style={{ display: 'grid', gap: '0.25rem' }}>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      Mục tiêu
                    </span>
                    <input
                      style={inputStyle}
                      value={c.objective}
                      onChange={(e) => updateCampaign(index, { objective: e.target.value })}
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.25rem' }}>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      Budget %
                    </span>
                    <input
                      style={inputStyle}
                      type="number"
                      min={0}
                      max={100}
                      value={c.budget_pct}
                      onChange={(e) =>
                        updateCampaign(index, { budget_pct: Number(e.target.value) || 0 })
                      }
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '0.25rem' }}>
                    <span className="muted" style={{ fontSize: '0.8rem' }}>
                      Timeline
                    </span>
                    <input
                      style={inputStyle}
                      value={c.timeline_weeks ?? ''}
                      onChange={(e) => updateCampaign(index, { timeline_weeks: e.target.value })}
                      onBlur={() => autosave.saveOnBlur()}
                    />
                  </label>
                </div>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Kênh (phân cách bằng dấu phẩy)
                  </span>
                  <input
                    style={inputStyle}
                    value={formatListField(c.channel_mix)}
                    onChange={(e) =>
                      updateCampaign(index, { channel_mix: parseListField(e.target.value) })
                    }
                    onBlur={() => autosave.saveOnBlur()}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    Milestones
                  </span>
                  <input
                    style={inputStyle}
                    value={formatListField(c.milestones)}
                    onChange={(e) =>
                      updateCampaign(index, { milestones: parseListField(e.target.value) })
                    }
                    onBlur={() => autosave.saveOnBlur()}
                  />
                </label>
                <label style={{ display: 'grid', gap: '0.25rem' }}>
                  <span className="muted" style={{ fontSize: '0.8rem' }}>
                    KPI
                  </span>
                  <input
                    style={inputStyle}
                    value={formatListField(c.kpis)}
                    onChange={(e) => updateCampaign(index, { kpis: parseListField(e.target.value) })}
                    onBlur={() => autosave.saveOnBlur()}
                  />
                </label>
              </>
            ) : (
              <>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{c.name}</p>
                <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
                  {c.objective} · {c.budget_pct}% · {c.timeline_weeks ?? '—'}
                </p>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                  Kênh: {(c.channel_mix ?? []).join(', ')}
                </p>
                {(c.kpis?.length ?? 0) > 0 ? (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
                    KPI: {c.kpis!.join(' · ')}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ))
      )}

      {onContinue ? (
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void flushAndContinue()}>
          Tiếp → Content
        </button>
      ) : null}
    </div>
  );
}
