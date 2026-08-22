'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  fetchResearchTaxonomy,
  INSIGHT_STATUS_LABELS,
  ResearchApiError,
  searchResearchInsights,
  TRANSITION_REASON_VI,
  type ResearchRagHit,
  type ResearchTaxonomyTheme,
} from '@/lib/market-research-api';
import { InsightStaleBanner } from '@/components/research/InsightStaleBanner';
import { ragHitIsStale } from '@/components/research/insight-stale.util';
import { RAG_SEARCH_BANNER, shouldShowRagSearch } from './insights-rag.util';

export function InsightsRagSearch({
  ragEnabled,
  clientId,
  prefillThemeCode,
}: {
  ragEnabled: boolean;
  clientId?: string;
  prefillThemeCode?: string;
}) {
  const [q, setQ] = useState('');
  const [themeCode, setThemeCode] = useState('');
  const [themes, setThemes] = useState<ResearchTaxonomyTheme[]>([]);
  const [hits, setHits] = useState<ResearchRagHit[]>([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [staleOnly, setStaleOnly] = useState(false);

  useEffect(() => {
    if (!shouldShowRagSearch(ragEnabled, true)) return;
    const token = getAccessToken();
    if (!token) return;
    void fetchResearchTaxonomy(token)
      .then((out) => setThemes(out.themes.filter((theme) => theme.active)))
      .catch(() => setThemes([]));
  }, [ragEnabled]);

  useEffect(() => {
    if (prefillThemeCode) setThemeCode(prefillThemeCode);
  }, [prefillThemeCode]);

  if (!shouldShowRagSearch(ragEnabled, true)) return null;

  async function runSearch(query: string, nextStaleOnly: boolean) {
    const token = getAccessToken();
    if (!token) return;
    if (!query) {
      setHits([]);
      setNote('');
      setError(TRANSITION_REASON_VI.rag_query_required);
      return;
    }
    setSearching(true);
    setError('');
    setNote('');
    try {
      const out = await searchResearchInsights(token, {
        q: query,
        theme_code: themeCode || undefined,
        client_id: clientId,
        stale_only: nextStaleOnly || undefined,
      });
      setHits(out.hits);
      if (out.note === 'rag_disabled') {
        setNote(TRANSITION_REASON_VI.rag_disabled);
      }
    } catch (err) {
      const api = err instanceof ResearchApiError ? err : null;
      if (api?.code && TRANSITION_REASON_VI[api.code]) {
        setError(TRANSITION_REASON_VI[api.code]);
      } else {
        setError(err instanceof Error ? err.message : 'Tìm insight thất bại');
      }
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function onSearch() {
    await runSearch(q.trim(), staleOnly);
  }

  return (
    <div style={{ marginTop: '0.75rem' }}>
      <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
        {RAG_SEARCH_BANNER}
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ flex: '1 1 12rem' }}>
          Tìm insight đã duyệt
          <input
            className="kpi-input"
            value={q}
            disabled={searching}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onSearch();
            }}
          />
        </label>
        <button type="button" className="btn btn-sm" disabled={searching} onClick={() => void onSearch()}>
          Tìm
        </button>
      </div>
      <label
        data-testid="staff-rag-stale-only"
        style={{
          display: 'flex',
          gap: '0.35rem',
          alignItems: 'center',
          marginTop: '0.45rem',
          fontSize: '0.85rem',
        }}
      >
        <input
          type="checkbox"
          checked={staleOnly}
          disabled={searching}
          onChange={(e) => {
            const next = e.target.checked;
            setStaleOnly(next);
            const query = q.trim();
            if (query) void runSearch(query, next);
          }}
        />
        Chỉ hết hạn{staleOnly ? ` (${hits.length})` : ''}
      </label>
      {themes.length > 0 ? (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
          {themes.map((theme) => {
            const active = themeCode === theme.theme_code;
            return (
              <button
                key={theme.id}
                type="button"
                className={active ? 'btn btn-sm' : 'btn btn-sm btn-secondary'}
                disabled={searching}
                onClick={() => setThemeCode(active ? '' : theme.theme_code)}
              >
                {theme.label_vi}
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
          {error}
        </p>
      ) : null}
      {note ? (
        <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
          {note}
        </p>
      ) : null}
      {!searching && staleOnly && hits.length === 0 && q.trim() && !error ? (
        <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
          Không có insight hết hạn khớp tìm kiếm.
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem' }}>
          {hits.map((hit) => (
            <li key={hit.insight_id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
              <Link href={`/crm/research/${hit.project_id}?tab=insights`}>{hit.statement}</Link>
              <span className="muted">
                {' '}
                · {hit.score.toFixed(2)} · {INSIGHT_STATUS_LABELS[hit.status] ?? hit.status}
              </span>
              {ragHitIsStale(hit) ? <InsightStaleBanner validTo={hit.valid_to} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
