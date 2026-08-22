'use client';

import { useState } from 'react';
import type { ResearchQuestion, ResearchSource } from '@/lib/market-research-api';

type SourceKeepTableProps = {
  sources: ResearchSource[];
  questions: ResearchQuestion[];
  canEdit: boolean;
  saving: boolean;
  onKeep: (source: ResearchSource, keep: boolean) => Promise<void>;
  onCreateManual: (input: { title: string; url?: string; publisher?: string; question_id?: number | null }) => Promise<void>;
  onCreateEvidence: (source: ResearchSource) => void;
};

export function SourceKeepTable({
  sources,
  questions,
  canEdit,
  saving,
  onKeep,
  onCreateManual,
  onCreateEvidence,
}: SourceKeepTableProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [publisher, setPublisher] = useState('');
  const [questionId, setQuestionId] = useState<string>('');

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreateManual({
      title: title.trim(),
      url: url.trim() || undefined,
      publisher: publisher.trim() || undefined,
      question_id: questionId ? Number(questionId) : null,
    });
    setTitle('');
    setUrl('');
    setPublisher('');
    setQuestionId('');
    setShowForm(false);
  }

  return (
    <div className="stack-gap">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem' }}>Nguồn</h2>
        {canEdit ? (
          <button type="button" className="btn btn-sm" disabled={saving} onClick={() => setShowForm((v) => !v)}>
            + Nguồn thủ công
          </button>
        ) : null}
      </div>
      {showForm ? (
        <form className="card" onSubmit={(e) => void submitManual(e)} style={{ padding: '0.85rem', display: 'grid', gap: '0.5rem' }}>
          <label>
            Tiêu đề *
            <input
              className="kpi-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            URL
            <input
              className="kpi-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Publisher
            <input
              className="kpi-input"
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            Câu hỏi nghiên cứu
            <select
              className="kpi-input"
              value={questionId}
              onChange={(e) => setQuestionId(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            >
              <option value="">—</option>
              {questions.map((q) => (
                <option key={q.id} value={q.id}>
                  Q{q.sort_order}: {q.question_vi}
                </option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn btn-sm" disabled={saving || !title.trim()}>
              Lưu nguồn
            </button>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>
              Huỷ
            </button>
          </div>
        </form>
      ) : null}
      {sources.length === 0 ? (
        <p className="muted">Chạy Desk Tavily hoặc thêm nguồn thủ công</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Keep</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>AI</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Độ tin</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Tiêu đề</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>Publisher</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }}>RQ</th>
                <th style={{ textAlign: 'left', padding: '0.4rem' }} />
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const rq = questions.find((q) => q.id === s.question_id);
                return (
                  <tr key={s.id}>
                    <td style={{ padding: '0.4rem' }}>
                      <input
                        type="checkbox"
                        checked={s.keep === true}
                        disabled={!canEdit || saving}
                        onChange={(e) => void onKeep(s, e.target.checked)}
                        aria-label={`Keep ${s.title}`}
                      />
                    </td>
                    <td style={{ padding: '0.4rem' }}>
                      {s.ai_generated ? (
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '0.05rem 0.4rem',
                            border: '1px dashed var(--primary)',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                          }}
                        >
                          AI
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{s.reliability_tier}</td>
                    <td style={{ padding: '0.4rem' }}>
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer">
                          {s.title}
                        </a>
                      ) : (
                        s.title
                      )}
                      {s.triangulated ? (
                        <span
                          style={{
                            display: 'inline-block',
                            marginLeft: 8,
                            padding: '0.05rem 0.4rem',
                            border: '1px solid var(--primary)',
                            borderRadius: 4,
                            fontSize: '0.75rem',
                          }}
                        >
                          Trùng 2 provider
                        </span>
                      ) : null}
                    </td>
                    <td style={{ padding: '0.4rem' }}>{s.publisher || '—'}</td>
                    <td style={{ padding: '0.4rem' }}>{rq ? `Q${rq.sort_order}` : '—'}</td>
                    <td style={{ padding: '0.4rem' }}>
                      {canEdit ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          disabled={saving}
                          onClick={() => onCreateEvidence(s)}
                        >
                          Tạo evidence
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
