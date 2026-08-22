'use client';

import { useState } from 'react';
import { postAiSummarize, type AiSummarizeResponse } from '@/lib/ai-api';
import { ApiError } from '@/lib/api';

interface Props {
  token: string;
  leadId: number;
  onError?: (msg: string) => void;
}

export function LeadBriefSection({ token, leadId, onError }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiSummarizeResponse['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    try {
      const out = await postAiSummarize(token, {
        context: 'lead_brief',
        entity_type: 'lead',
        entity_id: leadId,
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
    <section className="ai-copilot-section" aria-label="Tóm tắt nhanh lead">
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => void onGenerate()}
        disabled={loading}
      >
        {loading ? 'Đang tóm tắt…' : 'Tóm tắt nhanh'}
      </button>

      {loading ? <div className="ai-skeleton ai-skeleton--brief" aria-hidden="true" /> : null}

      {error ? <p className="error">{error}</p> : null}

      {result && !loading ? (
        <div className="ai-brief-result" aria-live="polite">
          <p className="ai-brief-result__summary">{result.summary}</p>
          {result.bullets?.length ? (
            <ul className="ai-brief-result__bullets">
              {result.bullets.slice(0, 5).map((b, i) => (
                <li key={`${i}-${b.slice(0, 24)}`}>{b}</li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            style={{ marginTop: '0.5rem' }}
            onClick={() => {
              const text = [result.summary, ...(result.bullets ?? [])].join('\n');
              void navigator.clipboard?.writeText(text);
            }}
          >
            Copy
          </button>
        </div>
      ) : null}
    </section>
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
