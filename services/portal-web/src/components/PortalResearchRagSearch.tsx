'use client';

import { useEffect, useState } from 'react';
import {
  portalResearchHealth,
  portalResearchInsightSearch,
  type PortalResearchRagHit,
} from '@/lib/api';
import {
  PORTAL_RAG_BANNER,
  shouldShowPortalRagSearch,
} from '@/lib/portal-research-rag.util';
import { ragHitIsStale } from '@/lib/insight-stale.util';
import { PortalInsightStaleBanner } from '@/components/PortalInsightStaleBanner';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { portalResearchErrorVi } from '@/lib/portal-research-errors';

export function PortalResearchRagSearch({
  token,
  prefillThemeCode,
}: {
  token: string;
  prefillThemeCode?: string;
}) {
  const [ragEnabled, setRagEnabled] = useState(false);
  const [q, setQ] = useState('');
  const [themeCode, setThemeCode] = useState('');
  const [hits, setHits] = useState<PortalResearchRagHit[]>([]);
  const [staleOnly, setStaleOnly] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isMarketResearchPortalFeEnabled()) return;
    void portalResearchHealth(token)
      .then((health) => setRagEnabled(health.rag_enabled))
      .catch(() => setRagEnabled(false));
  }, [token]);

  useEffect(() => {
    if (prefillThemeCode) setThemeCode(prefillThemeCode);
  }, [prefillThemeCode]);

  if (!shouldShowPortalRagSearch(isMarketResearchPortalFeEnabled(), ragEnabled)) {
    return null;
  }

  const staleCount = hits.filter((hit) => ragHitIsStale(hit)).length;

  async function runSearch(query: string, nextStaleOnly: boolean) {
    setSearching(true);
    setError('');
    setNote('');
    try {
      const out = await portalResearchInsightSearch(token, {
        q: query,
        theme_code: themeCode || undefined,
        stale_only: nextStaleOnly || undefined,
      });
      setHits(out.hits);
      if (out.note) {
        setNote(portalResearchErrorVi(out.note));
      }
    } catch (err) {
      setHits([]);
      setError(err instanceof Error ? err.message : portalResearchErrorVi('forbidden'));
    } finally {
      setSearching(false);
    }
  }

  async function onSearch() {
    const query = q.trim();
    if (!query) {
      setHits([]);
      setNote('');
      setError(portalResearchErrorVi('rag_query_required'));
      return;
    }
    await runSearch(query, staleOnly);
  }

  return (
    <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
      <p className="muted" style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
        {PORTAL_RAG_BANNER}
      </p>
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ flex: '1 1 12rem' }}>
          Tìm insight đã published
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
      {themeCode ? (
        <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
          Lọc theme: <strong>{themeCode}</strong>
          {' '}
          <button type="button" className="btn btn-sm btn-secondary" disabled={searching} onClick={() => setThemeCode('')}>
            Bỏ lọc
          </button>
        </p>
      ) : null}
      {hits.length > 0 && (staleCount > 0 || staleOnly) ? (
        <label
          style={{
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
            marginTop: '0.65rem',
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
          Chỉ hết hạn ({staleOnly ? hits.length : staleCount})
        </label>
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
      {!searching && staleOnly && hits.length === 0 && q.trim() ? (
        <p className="muted" style={{ margin: '0.4rem 0 0', fontSize: '0.85rem' }}>
          Không có insight hết hạn khớp tìm kiếm.
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.1rem' }}>
          {hits.map((hit) => (
            <li key={hit.insight_id} style={{ marginBottom: '0.35rem', fontSize: '0.85rem' }}>
              {hit.statement}
              <span className="muted">
                {' '}
                · {hit.score.toFixed(2)} · published
              </span>
              {ragHitIsStale(hit) ? <PortalInsightStaleBanner validTo={hit.valid_to} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
