'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NlQueryCatalogEntry, NlQueryResultPayload } from '@/lib/ai-api';
import { fetchNlQueryCatalog, postNlQuery } from '@/lib/ai-api';
import { formatVnd } from '@/lib/kpi/format';
import { NlQueryTrendChart } from './NlQueryTrendChart';

function formatCell(value: unknown, type?: string): string {
  if (value == null || value === '') return '—';
  if (type === 'currency') return formatVnd(Number(value));
  if (type === 'pct') return `${value}%`;
  return String(value);
}

function exportCsv(result: NlQueryResultPayload): void {
  const header = result.columns.map((col) => col.label).join(',');
  const lines = result.rows.map((row) =>
    result.columns
      .map((col) => {
        const raw = String(row[col.key] ?? '');
        return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
      })
      .join(','),
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nl-query-${result.intent_id}-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CuratedNlQueryPanel({ token }: { token: string }) {
  const [catalog, setCatalog] = useState<NlQueryCatalogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<NlQueryResultPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchNlQueryCatalog(token);
      setCatalog(out.data.intents);
      setSelectedId((prev) => prev || out.data.intents[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải catalog thất bại');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.aliases.some((alias) => alias.toLowerCase().includes(q)),
    );
  }, [catalog, filter]);

  async function runQuery(intentId?: string, freeText?: string) {
    setRunning(true);
    setError('');
    try {
      const out = await postNlQuery(token, {
        intent_id: intentId,
        question: freeText,
      });
      setResult(out.data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Chạy query thất bại');
    } finally {
      setRunning(false);
    }
  }

  function handlePresetRun() {
    if (!selectedId) return;
    void runQuery(selectedId);
  }

  function handleQuestionSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text) return;
    void runQuery(undefined, text);
  }

  return (
    <section className="nl-query-panel" data-testid="nl-query-panel">
      <div className="nl-query-panel__head">
        <p className="muted">
          NL Analytics curated · RNOS-22 · Read-only whitelist ({catalog.length || 50} câu hỏi)
        </p>
      </div>

      {error ? <p className="nl-query-panel__error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải catalog…</p> : null}

      {!loading ? (
        <div className="nl-query-panel__layout">
          <aside className="nl-query-panel__sidebar card">
            <label className="nl-query-panel__filter">
              <span className="muted">Tìm preset</span>
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Lead, SLA, CPL…"
              />
            </label>
            <ul className="nl-query-panel__presets" data-testid="nl-query-presets">
              {filtered.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    className={selectedId === entry.id ? 'is-active' : undefined}
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <strong>{entry.label}</strong>
                    <span className="muted">{entry.description}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn-primary"
              disabled={running || !selectedId}
              onClick={handlePresetRun}
            >
              {running ? 'Đang chạy…' : 'Chạy preset'}
            </button>
          </aside>

          <div className="nl-query-panel__main">
            <form className="nl-query-panel__question card" onSubmit={handleQuestionSubmit}>
              <label>
                <span className="muted">Hoặc gõ câu hỏi whitelist</span>
                <input
                  type="text"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="VD: CPL Meta T-30 theo client"
                  data-testid="nl-query-question"
                />
              </label>
              <button type="submit" className="btn btn-secondary" disabled={running || !question.trim()}>
                Gửi câu hỏi
              </button>
            </form>

            {result ? (
              <article className="nl-query-result card" data-testid="nl-query-result">
                <header className="nl-query-result__head">
                  <div>
                    <h3 style={{ margin: 0 }}>{result.label}</h3>
                    <p className="muted">{result.narrative}</p>
                  </div>
                  <div className="nl-query-result__actions">
                    {result.drill_href ? (
                      <Link href={result.drill_href} className="btn btn-secondary">
                        Drill-down
                      </Link>
                    ) : null}
                    <button type="button" className="btn btn-secondary" onClick={() => exportCsv(result)}>
                      Export CSV
                    </button>
                  </div>
                </header>

                {result.chart ? <NlQueryTrendChart chart={result.chart} /> : null}

                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {result.columns.map((col) => (
                          <th key={col.key}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows.length ? (
                        result.rows.map((row, idx) => (
                          <tr key={idx}>
                            {result.columns.map((col) => (
                              <td key={col.key}>{formatCell(row[col.key], col.type)}</td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={Math.max(result.columns.length, 1)} className="muted">
                            Không có dòng dữ liệu
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            ) : (
              <p className="muted">Chọn preset hoặc gõ câu hỏi whitelist để xem kết quả read-only.</p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
