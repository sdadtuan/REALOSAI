'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DraftAutosaveHint } from '@/components/mkt-ai/DraftAutosaveHint';
import { useIntakeAutosave } from '@/lib/crm/use-intake-autosave';
import {
  calendarWithinDays,
  contentDraftSnapshot,
  normalizeContentJson,
  type ContentAdCopyRow,
  type ContentCalendarRow,
} from '@/lib/mkt-ai-draft-fields';
import { patchMktAiDraft, type MktAiDraft } from '@/lib/mkt-ai-planner-api';

const inputStyle: React.CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '0.45rem 0.65rem',
  color: 'var(--text)',
  width: '100%',
  fontSize: '0.85rem',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: '3.5rem',
  resize: 'vertical',
};

type ContentTab = 'calendar' | 'ad_copy' | 'email';

interface Props {
  token: string;
  lifecycleId: number;
  contentJson: Record<string, unknown>;
  canEdit: boolean;
  paused?: boolean;
  resetAutosaveKey?: string | number;
  hasCampaigns?: boolean;
  onGenerate?: () => void;
  onDraftPersisted: (draft: MktAiDraft) => void;
  onSaveError?: (message: string) => void;
  onContinue?: () => void;
}

export function AiContentCalendar({
  token,
  lifecycleId,
  contentJson,
  canEdit,
  paused = false,
  resetAutosaveKey,
  hasCampaigns = false,
  onGenerate,
  onDraftPersisted,
  onSaveError,
  onContinue,
}: Props) {
  const [tab, setTab] = useState<ContentTab>('calendar');
  const [calendar, setCalendar] = useState<ContentCalendarRow[]>([]);
  const [adCopy, setAdCopy] = useState<ContentAdCopyRow[]>([]);
  const [emailSequence, setEmailSequence] = useState<string[]>([]);

  useEffect(() => {
    const normalized = normalizeContentJson(contentJson);
    setCalendar(normalized.calendar);
    setAdCopy(normalized.ad_copy);
    setEmailSequence(normalized.email_sequence);
  }, [contentJson, resetAutosaveKey]);

  const workingContent = useMemo(
    () => ({ calendar, ad_copy: adCopy, email_sequence: emailSequence }),
    [adCopy, calendar, emailSequence],
  );

  const snapshot = useMemo(() => contentDraftSnapshot(workingContent), [workingContent]);

  const persistDraft = useCallback(async () => {
    const draft = await patchMktAiDraft(token, lifecycleId, { content_json: workingContent });
    onDraftPersisted(draft);
  }, [lifecycleId, onDraftPersisted, token, workingContent]);

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

  const calendarRows = useMemo(() => {
    const ranged = calendarWithinDays(calendar, 30);
    return ranged.length ? ranged : calendar.slice(0, 30);
  }, [calendar]);

  function updateCalendarRow(index: number, patch: Partial<ContentCalendarRow>) {
    const row = calendarRows[index];
    if (!row) return;
    setCalendar((prev) =>
      prev.map((r) =>
        r.date === row.date && r.channel === row.channel && r.copy === row.copy
          ? { ...r, ...patch }
          : r,
      ),
    );
  }

  function updateAdCopy(index: number, patch: Partial<ContentAdCopyRow>) {
    setAdCopy((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function updateEmail(index: number, value: string) {
    setEmailSequence((prev) => prev.map((row, i) => (i === index ? value : row)));
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

  const tabs: { id: ContentTab; label: string }[] = [
    { id: 'calendar', label: 'Lịch 30 ngày' },
    { id: 'ad_copy', label: 'Ad copy' },
    { id: 'email', label: 'Email sequence' },
  ];

  return (
    <div className="card" style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-sm"
            disabled={paused || !hasCampaigns}
            onClick={() => onGenerate?.()}
          >
            Sinh content AI
          </button>
        ) : null}
        {canEdit ? (
          <DraftAutosaveHint
            status={autosave.status}
            savedAt={autosave.savedAt}
            dirty={autosave.dirty}
            entityLabel="content"
          />
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={tab === t.id ? 'btn btn-sm' : 'btn btn-sm btn-ghost'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' ? (
        calendarRows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có lịch content — sinh từ campaign hoặc thêm sau khi AI chạy.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.65rem' }}>
            {calendarRows.map((row, index) => (
              <div
                key={`${row.date}-${row.channel}-${index}`}
                className="card"
                style={{ padding: '0.65rem 0.75rem', border: '1px solid var(--border)' }}
              >
                {canEdit ? (
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                        gap: '0.45rem',
                      }}
                    >
                      <label style={{ display: 'grid', gap: '0.2rem' }}>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          Ngày
                        </span>
                        <input
                          style={inputStyle}
                          type="date"
                          value={row.date}
                          onChange={(e) => updateCalendarRow(index, { date: e.target.value })}
                          onBlur={() => autosave.saveOnBlur()}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '0.2rem' }}>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          Loại
                        </span>
                        <input
                          style={inputStyle}
                          value={row.type}
                          onChange={(e) => updateCalendarRow(index, { type: e.target.value })}
                          onBlur={() => autosave.saveOnBlur()}
                        />
                      </label>
                      <label style={{ display: 'grid', gap: '0.2rem' }}>
                        <span className="muted" style={{ fontSize: '0.75rem' }}>
                          Kênh
                        </span>
                        <input
                          style={inputStyle}
                          value={row.channel}
                          onChange={(e) => updateCalendarRow(index, { channel: e.target.value })}
                          onBlur={() => autosave.saveOnBlur()}
                        />
                      </label>
                    </div>
                    <label style={{ display: 'grid', gap: '0.2rem' }}>
                      <span className="muted" style={{ fontSize: '0.75rem' }}>
                        Copy
                      </span>
                      <textarea
                        style={textareaStyle}
                        value={row.copy}
                        onChange={(e) => updateCalendarRow(index, { copy: e.target.value })}
                        onBlur={() => autosave.saveOnBlur()}
                      />
                    </label>
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 80px 1fr',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                    }}
                  >
                    <span>{row.date}</span>
                    <span className="muted">{row.channel}</span>
                    <span>{row.copy}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : null}

      {tab === 'ad_copy' ? (
        adCopy.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có ad copy.
          </p>
        ) : (
          adCopy.map((row, index) => (
            <div
              key={`${row.variant}-${index}`}
              className="card"
              style={{ padding: '0.65rem 0.75rem', border: '1px solid var(--border)' }}
            >
              {canEdit ? (
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  <input
                    style={inputStyle}
                    value={row.headline}
                    placeholder="Headline"
                    onChange={(e) => updateAdCopy(index, { headline: e.target.value })}
                    onBlur={() => autosave.saveOnBlur()}
                  />
                  <textarea
                    style={textareaStyle}
                    value={row.body}
                    placeholder="Body"
                    onChange={(e) => updateAdCopy(index, { body: e.target.value })}
                    onBlur={() => autosave.saveOnBlur()}
                  />
                  <input
                    style={inputStyle}
                    value={row.cta}
                    placeholder="CTA"
                    onChange={(e) => updateAdCopy(index, { cta: e.target.value })}
                    onBlur={() => autosave.saveOnBlur()}
                  />
                </div>
              ) : (
                <>
                  <strong>{row.headline}</strong>
                  <p style={{ margin: '0.35rem 0', fontSize: '0.85rem' }}>{row.body}</p>
                  <span className="muted">{row.cta}</span>
                </>
              )}
            </div>
          ))
        )
      ) : null}

      {tab === 'email' ? (
        emailSequence.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Chưa có email sequence.
          </p>
        ) : (
          emailSequence.map((line, index) =>
            canEdit ? (
              <input
                key={`email-${index}`}
                style={inputStyle}
                value={line}
                onChange={(e) => updateEmail(index, e.target.value)}
                onBlur={() => autosave.saveOnBlur()}
              />
            ) : (
              <p key={`email-${index}`} style={{ margin: 0, fontSize: '0.85rem' }}>
                {line}
              </p>
            ),
          )
        )
      ) : null}

      {onContinue ? (
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => void flushAndContinue()}>
          Tiếp → Apply
        </button>
      ) : null}
    </div>
  );
}
