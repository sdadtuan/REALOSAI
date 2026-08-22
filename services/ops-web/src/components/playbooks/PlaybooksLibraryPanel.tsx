'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlaybookById,
  fetchPlaybooks,
  postPlaybookRagQuery,
  type PlaybookChunkRow,
  type PlaybookCitation,
  type PlaybookRow,
} from '@/lib/playbooks-api';

interface Props {
  token: string;
}

export function PlaybooksLibraryPanel({ token }: Props) {
  const [rows, setRows] = useState<PlaybookRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<PlaybookRow | null>(null);
  const [chunks, setChunks] = useState<PlaybookChunkRow[]>([]);
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<PlaybookCitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadList = useCallback(async () => {
    setError('');
    try {
      const out = await fetchPlaybooks(token, { limit: 50 });
      setRows(out.data.rows);
      if (!selectedId && out.data.rows[0]) {
        setSelectedId(out.data.rows[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải playbook');
    }
  }, [selectedId, token]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) return;
    void (async () => {
      setBusy(true);
      setError('');
      try {
        const out = await fetchPlaybookById(token, selectedId);
        setSelected(out.data.playbook);
        setChunks(out.data.chunks);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải chi tiết playbook');
      } finally {
        setBusy(false);
      }
    })();
  }, [selectedId, token]);

  const runRag = async () => {
    if (query.trim().length < 2) return;
    setBusy(true);
    setError('');
    try {
      const out = await postPlaybookRagQuery(token, {
        query: query.trim(),
        playbook_id: selectedId ?? undefined,
        limit: 5,
      });
      setAnswer(out.data.answer);
      setCitations(out.data.citations);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'RAG query thất bại');
      setAnswer('');
      setCitations([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="playbooks-library-panel">
      <div className="playbooks-library-header">
        <h2>Playbook library</h2>
        <p className="muted">RNOS-12/36 — RAG retrieval với cite nguồn chunk (PostgreSQL vector store).</p>
      </div>

      <div className="playbooks-library-layout">
        <aside className="playbooks-list">
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`playbooks-list-item${selectedId === row.id ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <strong>{row.title}</strong>
                  <span className="muted">{row.category}</span>
                  <span className="muted">{row.chunk_count ?? 0} chunks</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="playbooks-detail">
          {selected ? (
            <>
              <h3>{selected.title}</h3>
              <p className="muted">{selected.summary}</p>
              <div className="playbooks-chunks">
                {chunks.map((c) => (
                  <article key={c.id} className="playbooks-chunk-card">
                    <h4>{c.title}</h4>
                    <p>{c.body}</p>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p className="muted">Chọn playbook để xem chunks.</p>
          )}
        </section>

        <section className="playbooks-rag">
          <h3>RAG query</h3>
          <div className="playbooks-rag-form">
            <input
              className="playbooks-rag-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Hỏi playbook… (vd: deal stalled gọi lại)"
              aria-label="Playbook RAG query"
            />
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void runRag()}>
              Tìm + cite
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {answer ? (
            <div className="playbooks-rag-answer">
              <pre>{answer}</pre>
              {citations.length > 0 ? (
                <ul className="playbooks-citations">
                  {citations.map((c) => (
                    <li key={c.chunk_id}>
                      <strong>{c.playbook_title}</strong> · {c.chunk_title}
                      <span className="muted"> (score {c.score})</span>
                      <p>{c.excerpt}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
