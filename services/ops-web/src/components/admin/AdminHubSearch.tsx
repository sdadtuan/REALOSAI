'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseAdminSearchPrefix,
  searchAdminRoutes,
  type AdminSearchHit,
} from '@/lib/admin/admin-search';
import { canViewAdminSection } from '@/lib/admin/admin-nav';
import { getStoredUser } from '@/lib/auth';

type AdminHubSearchProps = {
  user: ReturnType<typeof getStoredUser>;
};

export function AdminHubSearch({ user }: AdminHubSearchProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AdminSearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = 'admin-hub-search-results';

  const runSearch = useCallback(
    (raw: string) => {
      if (!user || !canViewAdminSection(user)) {
        setHits([]);
        return;
      }
      const { query: q } = parseAdminSearchPrefix(raw);
      setHits(searchAdminRoutes(user, q, 8));
    },
    [user],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => runSearch(query), 150);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => {
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  if (!user || !canViewAdminSection(user)) return null;

  return (
    <div className="admin-cp-hub-search global-search-bar" ref={wrapRef}>
      <div className="global-search-input-wrap">
        <input
          className="global-search-input"
          type="search"
          placeholder="Tìm trong Quản trị… (onboard, ma trận, AI)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (hits.length || query.trim().length >= 2) setOpen(true);
          }}
          aria-label="Tìm trong Quản trị hệ thống"
          aria-controls={listboxId}
          aria-expanded={open && hits.length > 0}
          role="combobox"
        />
      </div>
      {open && query.trim().length >= 2 ? (
        <div
          id={listboxId}
          className="global-search-dropdown"
          role="listbox"
          aria-label="Kết quả tìm kiếm quản trị"
        >
          {hits.length === 0 ? (
            <p className="global-search-empty muted">Không có route quản trị phù hợp</p>
          ) : (
            hits.map((hit) => (
              <Link
                key={hit.href}
                href={hit.href}
                className="global-search-hit global-search-hit--admin"
                role="option"
                onClick={() => {
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span className="global-search-hit-type">{hit.groupLabel}</span>
                <strong>{hit.label}</strong>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
