'use client';

import { useMemo, useState } from 'react';
import { postAiSummarize, type AiSummarizeResponse } from '@/lib/ai-api';
import type { LeadActivityRow } from '@/lib/api';
import { ApiError } from '@/lib/api';

interface Props {
  token: string;
  leadId: number;
  activities: LeadActivityRow[];
  selectedActivityId?: number | null;
  onSelectActivity?: (id: number | null) => void;
  onError?: (msg: string) => void;
}

export function SummarizeSection({
  token,
  leadId,
  activities,
  selectedActivityId,
  onSelectActivity,
  onError,
}: Props) {
  const [mode, setMode] = useState<'activity' | 'paste'>('activity');
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSummarizeResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => activities.find((a) => a.id === selectedActivityId) ?? null,
    [activities, selectedActivityId],
  );

  const activityText = useMemo(() => {
    if (!selected) return '';
    return [selected.content, selected.result].filter(Boolean).join('\n').trim();
  }, [selected]);

  async function onSummarize() {
    const text = mode === 'paste' ? pasteText.trim() : activityText;
    if (text.length < 50) {
      const msg = 'Cần nội dung ≥ 50 ký tự (chọn activity hoặc dán ghi chú).';
      setError(msg);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const out = await postAiSummarize(token, {
        context: 'activity',
        entity_type: 'lead',
        entity_id: leadId,
        text,
      });
      setResult(out.data);
    } catch (err) {
      const msg = formatAiError(err);
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ai-copilot-section" aria-label="Tóm tắt hoạt động">
      <h4 className="ai-copilot-section__title">Tóm tắt hoạt động</h4>

      <div className="ai-summarize-mode">
        <label className="ai-radio">
          <input
            type="radio"
            name="summarize-mode"
            checked={mode === 'activity'}
            onChange={() => setMode('activity')}
          />
          Chọn activity
        </label>
        <label className="ai-radio">
          <input
            type="radio"
            name="summarize-mode"
            checked={mode === 'paste'}
            onChange={() => setMode('paste')}
          />
          Dán nội dung
        </label>
      </div>

      {mode === 'activity' ? (
        <label className="ai-field">
          <span className="muted">Hoạt động</span>
          <select
            value={selectedActivityId ?? ''}
            onChange={(e) => onSelectActivity?.(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">— Chọn —</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>
                {a.created_at?.slice(0, 16)} · {a.activity_type_label || a.activity_type}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="ai-field">
          <span className="muted">Nội dung (≥50 ký tự)</span>
          <textarea
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Dán ghi chú call / activity…"
          />
        </label>
      )}

      <button type="button" className="btn btn-sm" onClick={() => void onSummarize()} disabled={loading}>
        {loading ? 'Đang tóm tắt…' : 'Tóm tắt'}
      </button>

      {loading ? <div className="ai-skeleton ai-skeleton--summary" aria-hidden="true" /> : null}
      {error ? <p className="error">{error}</p> : null}

      {result && !loading ? (
        <div className="ai-summary-result" aria-live="polite">
          <p>{result.summary}</p>
          <ExtractedFields extracted={result.extracted} />
        </div>
      ) : null}

      {!activities.length && mode === 'activity' ? (
        <p className="muted">Ghi activity hoặc dán nội dung (≥50 ký tự).</p>
      ) : null}
    </section>
  );
}

function ExtractedFields({ extracted }: { extracted: AiSummarizeResponse['data']['extracted'] }) {
  const rows: Array<[string, string | null]> = [
    ['Ý định', extracted.intent],
    ['Next action', extracted.next_action],
    ['Nguồn', extracted.source],
  ];
  const objections = extracted.objections?.filter(Boolean) ?? [];
  return (
    <dl className="ai-extracted">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} className="ai-extracted__row">
            <dt className="muted">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      {objections.length ? (
        <div className="ai-extracted__row">
          <dt className="muted">Phản đối</dt>
          <dd>{objections.join('; ')}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function formatAiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return 'Không có quyền xem lead này (BR-AI-04).';
    if (err.status === 429) return 'Quá nhiều yêu cầu — thử lại sau 1 phút.';
    if (err.status === 503) return 'AI tạm ngưng — thử lại sau.';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Lỗi AI';
}
