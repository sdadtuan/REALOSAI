'use client';

import { useState } from 'react';
import { postMktAiSectionComment, type MktAiSectionCommentRow } from '@/lib/mkt-ai-planner-api';

interface Props {
  token: string;
  lifecycleId: number;
  sectionKey: string;
  sectionLabel: string;
  canEdit: boolean;
  paused?: boolean;
  comments: MktAiSectionCommentRow[];
  onCommentAdded: (row: MktAiSectionCommentRow) => void;
  onError?: (message: string) => void;
}

export function AiSectionCommentThread({
  token,
  lifecycleId,
  sectionKey,
  sectionLabel,
  canEdit,
  paused = false,
  comments,
  onCommentAdded,
  onError,
}: Props) {
  const [body, setBody] = useState('');
  const [mention, setMention] = useState('');
  const [busy, setBusy] = useState(false);
  const thread = comments.filter((c) => c.section_key === sectionKey);

  async function submit() {
    if (!canEdit || paused || !body.trim()) return;
    setBusy(true);
    onError?.('');
    try {
      const row = await postMktAiSectionComment(token, lifecycleId, {
        section_key: sectionKey,
        body: body.trim(),
        mention_email: mention.trim() || undefined,
      });
      onCommentAdded(row);
      setBody('');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Gửi comment thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        marginTop: '0.5rem',
        padding: '0.65rem 0.75rem',
        borderRadius: 8,
        border: '1px dashed var(--border)',
        fontSize: '0.85rem',
      }}
    >
      <div className="muted" style={{ marginBottom: '0.35rem' }}>
        Comment staff — {sectionLabel}
      </div>
      {thread.length === 0 ? (
        <p className="muted" style={{ margin: '0 0 0.5rem' }}>
          Chưa có comment.
        </p>
      ) : (
        <ul style={{ margin: '0 0 0.5rem', paddingLeft: '1.1rem' }}>
          {thread.map((c) => (
            <li key={c.id}>
              <strong>{c.author_email}</strong>
              {c.mention_email ? ` @${c.mention_email}` : ''}: {c.body}
            </li>
          ))}
        </ul>
      )}
      {canEdit ? (
        <div style={{ display: 'grid', gap: '0.35rem' }}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Comment nội bộ…"
            rows={2}
            style={{ width: '100%', fontSize: '0.85rem' }}
            disabled={paused || busy}
          />
          <input
            value={mention}
            onChange={(e) => setMention(e.target.value)}
            placeholder="@mention email (tuỳ chọn)"
            style={{ width: '100%', fontSize: '0.85rem' }}
            disabled={paused || busy}
          />
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            disabled={paused || busy || !body.trim()}
            onClick={() => void submit()}
          >
            Gửi comment
          </button>
        </div>
      ) : null}
    </div>
  );
}
