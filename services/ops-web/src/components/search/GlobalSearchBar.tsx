'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseAdminSearchPrefix,
  searchAdminRoutes,
  type AdminSearchHit,
} from '@/lib/admin/admin-search';
import { canViewAdminSection } from '@/lib/admin/admin-nav';
import { getAccessToken, getStoredUser } from '@/lib/auth';
import {
  SEARCH_ENTITY_LABELS,
  fetchGlobalSearch,
  type GlobalSearchHit,
  type SearchEntityType,
} from '@/lib/search-api';

type EntityFilter = '' | SearchEntityType | 'admin';

const ENTITY_FILTERS: Array<{ value: EntityFilter; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'admin', label: 'Quản trị' },
  { value: 'lead', label: 'Lead' },
  { value: 'deal', label: 'Deal' },
  { value: 'ticket', label: 'Ticket' },
  { value: 'account', label: 'Account' },
  { value: 'contact', label: 'Contact' },
];

export function GlobalSearchBar() {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState<EntityFilter>('');
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [adminHits, setAdminHits] = useState<AdminSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [engine, setEngine] = useState<'opensearch' | 'sqlite' | ''>('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const runAdminSearch = useCallback((raw: string, limit = 5) => {
    const user = getStoredUser();
    if (!user || !canViewAdminSection(user)) {
      setAdminHits([]);
      return;
    }
    const { query: q } = parseAdminSearchPrefix(raw);
    setAdminHits(searchAdminRoutes(user, q, limit));
  }, []);

  const runCrmSearch = useCallback(async (q: string, type: '' | SearchEntityType) => {
    const token = getAccessToken();
    if (!token || q.trim().length < 2) {
      setHits([]);
      setEngine('');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const out = await fetchGlobalSearch(token, q.trim(), {
        entity_type: type || undefined,
        limit: 12,
      });
      setHits(out.data.hits);
      setEngine(out.data.engine);
      setOpen(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tìm kiếm thất bại';
      setError(
        msg.includes('503') || msg.toLowerCase().includes('opensearch')
          ? 'OpenSearch chưa sẵn sàng — cần OPENSEARCH_URL'
          : msg,
      );
      setHits([]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const { query: stripped, adminOnly } = parseAdminSearchPrefix(query);
      const effectiveType: EntityFilter = adminOnly ? 'admin' : entityType;

      if (stripped.trim().length < 2) {
        setAdminHits([]);
        setHits([]);
        setEngine('');
        return;
      }

      if (effectiveType === 'admin') {
        runAdminSearch(stripped, 12);
        setHits([]);
        setEngine('');
        setError('');
        setOpen(true);
        return;
      }

      runAdminSearch(stripped, 5);
      void runCrmSearch(stripped, effectiveType === '' ? '' : effectiveType);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, entityType, runAdminSearch, runCrmSearch]);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const showDropdown =
    open &&
    (adminHits.length > 0 ||
      hits.length > 0 ||
      error ||
      query.trim().length >= 2);

  return (
    <div className="global-search-bar" ref={wrapRef}>
      <div className="global-search-input-wrap">
        <input
          className="global-search-input"
          type="search"
          placeholder="Tìm CRM hoặc Quản trị…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (adminHits.length || hits.length) setOpen(true);
          }}
          aria-label="Tìm kiếm CRM và Quản trị"
        />
        {busy ? <span className="global-search-spinner muted">…</span> : null}
      </div>
      <div className="global-search-filters" role="tablist" aria-label="Lọc loại thực thể">
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            className={`global-search-filter${entityType === f.value ? ' is-active' : ''}`}
            onClick={() => setEntityType(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {showDropdown ? (
        <div className="global-search-dropdown" role="listbox" aria-label="Kết quả tìm kiếm">
          {error ? <p className="global-search-empty error">{error}</p> : null}
          {adminHits.length > 0 ? (
            <div className="global-search-section">
              <span className="global-search-section-label">Quản trị hệ thống</span>
              {adminHits.map((hit) => (
                <Link
                  key={`admin:${hit.href}`}
                  href={hit.href}
                  className="global-search-hit global-search-hit--admin"
                  onClick={() => setOpen(false)}
                >
                  <span className="global-search-hit-type">{hit.groupLabel}</span>
                  <strong>{hit.label}</strong>
                </Link>
              ))}
            </div>
          ) : null}
          {!error && entityType === 'admin' && adminHits.length === 0 && query.trim().length >= 2 ? (
            <p className="global-search-empty muted">Không có route quản trị phù hợp</p>
          ) : null}
          {!error && entityType !== 'admin' && hits.length === 0 && adminHits.length === 0 && query.trim().length >= 2 ? (
            <p className="global-search-empty muted">Không có kết quả CRM</p>
          ) : null}
          {entityType !== 'admin'
            ? hits.map((hit) => (
                <Link
                  key={`${hit.entity_type}:${hit.entity_id}`}
                  href={hit.route_path ?? '/crm'}
                  className="global-search-hit"
                  onClick={() => setOpen(false)}
                >
                  <span className="global-search-hit-type">{SEARCH_ENTITY_LABELS[hit.entity_type]}</span>
                  <strong>{hit.title}</strong>
                  {hit.subtitle ? <span className="muted">{hit.subtitle}</span> : null}
                  {hit.snippet ? <span className="global-search-hit-snippet">{hit.snippet}</span> : null}
                </Link>
              ))
            : null}
          {engine && entityType !== 'admin' ? (
            <p className="global-search-meta muted">
              Engine: {engine} · {hits.length} kết quả CRM
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
