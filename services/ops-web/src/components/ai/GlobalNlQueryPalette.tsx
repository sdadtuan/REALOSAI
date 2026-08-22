'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchNlQueryCatalog, postNlQuery, type NlQueryCatalogEntry, type NlQueryResultPayload } from '@/lib/ai-api';
import { getAccessToken, getStoredUser, hasCap } from '@/lib/auth';

export function GlobalNlQueryPalette() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<NlQueryCatalogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NlQueryResultPayload | null>(null);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey))) return;
      const token = getAccessToken();
      const user = getStoredUser();
      const allowed =
        Boolean(token && user) &&
        (hasCap(user, 'ai_analytics', 'query') || hasCap(user, 'ai_admin', 'view'));
      if (!allowed) return;
      event.preventDefault();
      setOpen((value) => !value);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const token = getAccessToken();
    if (!token || catalog.length) return;
    void fetchNlQueryCatalog(token)
      .then((response) => setCatalog(response.data.intents))
      .catch((err) => setError(err instanceof Error ? err.message : 'Tải preset thất bại'));
  }, [catalog.length, open]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return catalog.slice(0, 10);
    return catalog
      .filter(
        (entry) =>
          entry.label.toLowerCase().includes(normalized) ||
          entry.description.toLowerCase().includes(normalized) ||
          entry.aliases.some((alias) => alias.toLowerCase().includes(normalized)),
      )
      .slice(0, 10);
  }, [catalog, query]);

  async function run(intentId?: string) {
    const token = getAccessToken();
    if (!token) return;
    setRunning(true);
    setError('');
    try {
      const response = await postNlQuery(token, intentId ? { intent_id: intentId } : { question: query.trim() });
      setResult(response.data);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Chạy query thất bại');
    } finally {
      setRunning(false);
    }
  }

  if (!open) return null;

  return (
    <div className="nl-palette-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section
        className="nl-palette"
        role="dialog"
        aria-modal="true"
        aria-label="NL Analytics"
        data-testid="global-nl-query-palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (query.trim()) void run();
          }}
        >
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResult(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
            placeholder="Tìm preset hoặc hỏi NL Analytics…"
            aria-label="Tìm câu hỏi analytics"
          />
        </form>
        {error ? <p className="nl-query-panel__error">{error}</p> : null}
        {result ? (
          <div className="nl-palette__result">
            <strong>{result.label}</strong>
            <p>{result.narrative}</p>
          </div>
        ) : (
          <ul className="nl-palette__list">
            {filtered.map((entry) => (
              <li key={entry.id}>
                <button type="button" disabled={running} onClick={() => void run(entry.id)}>
                  <strong>{entry.label}</strong>
                  <span>{entry.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <footer>{running ? 'Đang chạy…' : 'Enter để hỏi · Esc để đóng · Read-only'}</footer>
      </section>
    </div>
  );
}
