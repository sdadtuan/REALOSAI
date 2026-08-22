'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { HubPageLayout } from '@/components/layout';
import { PortalConjointLite } from '@/components/PortalConjointLite';
import { PortalPageShell } from '@/components/PortalPageShell';
import { PortalResearchRagSearch } from '@/components/PortalResearchRagSearch';
import { PortalThemeQuarterTable } from '@/components/PortalThemeQuarterTable';
import {
  portalResearchConjoint,
  portalResearchReports,
  portalResearchThemeQuarterAnalytics,
  type PortalCjSummary,
  type PortalResearchReportCard,
  type PortalThemeQuarterAnalyticsPayload,
} from '@/lib/api';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { portalResearchErrorVi } from '@/lib/portal-research-errors';
import {
  PORTAL_REPORT_LIST_STALE_BADGE,
  PORTAL_REPORT_STALE_ONLY_EMPTY,
  PORTAL_REPORT_STALE_ONLY_LABEL,
  countPortalReportCardsWithStaleInsights,
  filterPortalReportCardsByStale,
  shouldShowReportListStaleBadge,
} from '@/lib/portal-report-list.util';

const PORTAL_THEME_ANALYTICS_BANNER =
  'Chỉ insight đã published cùng khách. Đếm theo theme gắn trên insight, bucket theo quý (updated_at).';

export default function PortalResearchListPage() {
  return (
    <PortalPageShell
      breadcrumb={[{ label: 'Client Portal', href: '/dashboard' }, { label: 'Nghiên cứu' }]}
    >
      {({ token }) => <ResearchListContent token={token} />}
    </PortalPageShell>
  );
}

function ResearchListContent({ token }: { token: string }) {
  const [allItems, setAllItems] = useState<PortalResearchReportCard[]>([]);
  const [items, setItems] = useState<PortalResearchReportCard[]>([]);
  const [themeData, setThemeData] = useState<PortalThemeQuarterAnalyticsPayload | null>(null);
  const [conjoint, setConjoint] = useState<PortalCjSummary | null>(null);
  const [selectedThemeCode, setSelectedThemeCode] = useState('');
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [staleOnly, setStaleOnly] = useState(false);

  const staleCount = countPortalReportCardsWithStaleInsights(allItems);
  const visibleItems = items;

  const yearOptions = useMemo(() => {
    const current = new Date().getUTCFullYear();
    return [current, current - 1, current - 2];
  }, []);

  const loadReports = useCallback(
    async (nextStaleOnly: boolean) => {
      const full = await portalResearchReports(token);
      const fullItems = full.items ?? [];
      setAllItems(fullItems);
      if (!nextStaleOnly) {
        setItems(fullItems);
        return;
      }
      try {
        const filtered = await portalResearchReports(token, { stale_only: true });
        setItems(filtered.items ?? filterPortalReportCardsByStale(fullItems, true));
      } catch {
        setItems(filterPortalReportCardsByStale(fullItems, true));
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isMarketResearchPortalFeEnabled()) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        await loadReports(staleOnly);
        const [themes, cj] = await Promise.all([
          portalResearchThemeQuarterAnalytics(token, { year }),
          portalResearchConjoint(token),
        ]);
        setThemeData(themes);
        setConjoint(cj.summary ?? null);
      } catch (err) {
        setError(portalResearchErrorVi(err instanceof Error ? err.message : ''));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, year, staleOnly, loadReports]);

  if (!isMarketResearchPortalFeEnabled()) {
    return (
      <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố">
        <p className="muted">Nghiên cứu thị trường chưa bật.</p>
      </HubPageLayout>
    );
  }

  return (
    <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố — chỉ xem">
      <section className="stack-gap" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Theme theo quý</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.9rem' }}>
            Năm
            <select
              className="kpi-input"
              value={year}
              disabled={loading}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          {PORTAL_THEME_ANALYTICS_BANNER}
        </p>
        {themeData ? (
          <PortalThemeQuarterTable
            rows={themeData.rows}
            year={themeData.year}
            selectedThemeCode={selectedThemeCode}
            onThemeClick={setSelectedThemeCode}
          />
        ) : null}
      </section>
      {conjoint ? <PortalConjointLite summary={conjoint} /> : null}
      <PortalResearchRagSearch token={token} prefillThemeCode={selectedThemeCode || undefined} />
      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : allItems.length === 0 ? (
        <p className="muted">Chưa có báo cáo được công bố.</p>
      ) : (
        <>
          {(staleCount > 0 || staleOnly) && allItems.length > 0 ? (
            <label
              data-testid="portal-report-stale-only-filter"
              style={{
                display: 'inline-flex',
                gap: 6,
                alignItems: 'center',
                marginBottom: '0.65rem',
                fontSize: '0.85rem',
              }}
            >
              <input
                type="checkbox"
                checked={staleOnly}
                disabled={loading}
                onChange={(e) => setStaleOnly(e.target.checked)}
              />
              {PORTAL_REPORT_STALE_ONLY_LABEL} ({staleOnly ? visibleItems.length : staleCount})
            </label>
          ) : null}
          {staleOnly && visibleItems.length === 0 && allItems.length > 0 ? (
            <p className="muted" data-testid="portal-report-stale-only-empty">
              {PORTAL_REPORT_STALE_ONLY_EMPTY}
            </p>
          ) : null}
          {visibleItems.length > 0 ? (
        <ul className="portal-content-list">
          {visibleItems.map((item) => (
            <li
              key={item.version_id}
              className="portal-content-list__item"
              data-testid={`portal-report-list-row-${item.version_id}`}
            >
              <Link href={`/research/${item.version_id}`} className="portal-content-list__link">
                Phiên bản {item.version}
              </Link>
              {shouldShowReportListStaleBadge(item) ? (
                <span
                  className="muted"
                  data-testid="portal-report-stale-badge"
                  style={{
                    display: 'inline-block',
                    marginLeft: '0.5rem',
                    padding: '0.15rem 0.45rem',
                    borderRadius: 6,
                    fontSize: '0.78rem',
                    background: 'rgba(180, 83, 9, 0.12)',
                    color: '#92400e',
                  }}
                >
                  {PORTAL_REPORT_LIST_STALE_BADGE}
                </span>
              ) : null}
              <span className="muted">
                {item.as_of ? `As of ${item.as_of}` : 'As of —'}
                {item.expires_at ? ` · Hết hạn ${item.expires_at}` : ''}
              </span>
            </li>
          ))}
        </ul>
          ) : null}
        </>
      )}
    </HubPageLayout>
  );
}
