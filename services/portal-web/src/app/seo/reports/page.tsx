'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@/components/layout';
import { SeoPortalShell } from '@/components/seo/SeoPortalShell';
import { portalSeoExecutiveReport, type PortalSeoReportType } from '@/lib/api';

const REPORT_TABS: { id: PortalSeoReportType; label: string }[] = [
  { id: 'executive', label: 'Tổng quan' },
  { id: 'seo', label: 'SEO' },
  { id: 'aeo', label: 'AEO' },
  { id: 'technical', label: 'Kỹ thuật' },
  { id: 'content', label: 'Nội dung' },
];

const REPORT_TAB_IDS = new Set(REPORT_TABS.map((t) => t.id));

function tabFromQuery(raw: string | null): PortalSeoReportType {
  if (raw && REPORT_TAB_IDS.has(raw as PortalSeoReportType)) {
    return raw as PortalSeoReportType;
  }
  return 'executive';
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="kpi-tile">
      <p className="kpi-tile__label">{label}</p>
      <p className="kpi-tile__value">{value}</p>
    </div>
  );
}

function ReportBody({ report }: { report: Record<string, unknown> }) {
  const gsc = (report.gsc as Record<string, unknown>) || {};
  const aeo = (report.aeo as Record<string, unknown>) || {};
  const authority = (report.authority as Record<string, unknown>) || {};
  const contentByStatus = (report.content_by_status as Record<string, number>) || {};
  const severity = (report.severity as Record<string, number>) || {};
  const issues = (report.issues as Array<Record<string, string>>) || [];
  const mentions = (report.mentions_recent as Array<Record<string, unknown>>) || [];

  return (
    <div className="stack-gap">
      {(gsc.clicks != null || gsc.impressions != null) && (
        <div className="kpi-tile-grid">
          {gsc.clicks != null && <Stat label="Clicks (GSC)" value={String(gsc.clicks)} />}
          {gsc.impressions != null && <Stat label="Impressions" value={String(gsc.impressions)} />}
          {gsc.avg_ctr != null && (
            <Stat label="Avg CTR" value={`${(Number(gsc.avg_ctr) * 100).toFixed(2)}%`} />
          )}
          {gsc.queries != null && <Stat label="Queries" value={String(gsc.queries)} />}
        </div>
      )}

      {report.critical_issues != null && (
        <Stat label="Critical issues (open)" value={String(report.critical_issues)} />
      )}

      {aeo.coverage_pct != null && (
        <Stat
          label="AEO coverage"
          value={`${aeo.coverage_pct}% (${aeo.visible ?? 0}/${aeo.total ?? 0} queries)`}
        />
      )}

      {authority.total_signals != null && (
        <Stat label="Authority signals" value={String(authority.total_signals)} />
      )}

      {Object.keys(contentByStatus).length > 0 && (
        <section className="portal-hub-section">
          <h3 className="portal-hub-section__title">Content pipeline</h3>
          <ul className="portal-list">
            {Object.entries(contentByStatus).map(([k, v]) => (
              <li key={k}>
                <strong>{k}</strong>: {v}
              </li>
            ))}
          </ul>
        </section>
      )}

      {Object.keys(severity).length > 0 && (
        <section className="portal-hub-section">
          <h3 className="portal-hub-section__title">Severity matrix</h3>
          <ul className="portal-list">
            {Object.entries(severity).map(([k, v]) => (
              <li key={k}>
                <strong>{k}</strong>: {v}
              </li>
            ))}
          </ul>
        </section>
      )}

      {issues.length > 0 && (
        <section className="portal-hub-section">
          <h3 className="portal-hub-section__title">Open technical issues</h3>
          <div className="portal-table-stack">
            <table className="perf-table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((row, i) => (
                  <tr key={i}>
                    <td data-label="URL">{row.url}</td>
                    <td data-label="Type">{row.issue_type}</td>
                    <td data-label="Severity">{row.severity}</td>
                    <td data-label="Status">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {mentions.length > 0 && (
        <section className="portal-hub-section">
          <h3 className="portal-hub-section__title">AI mentions (30 ngày)</h3>
          <ul className="portal-list">
            {mentions.map((m, i) => (
              <li key={i}>
                {String(m.stat_date ?? '—')} — {String(m.mention_count ?? 0)} mentions (
                {String(m.citation_status ?? '')})
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function SeoReportsPage() {
  return (
    <SeoPortalShell
      title="Báo cáo SEO / AEO"
      subtitle="Read-only — executive, SEO, AEO, kỹ thuật, nội dung"
      actions={
        <Link href="/seo/content" className="btn btn-secondary btn-sm">
          Nội dung chờ duyệt →
        </Link>
      }
    >
      {({ token, seoEnabled }) =>
        seoEnabled ? <SeoReportsContent token={token} /> : null
      }
    </SeoPortalShell>
  );
}

function SeoReportsContent({ token }: { token: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<PortalSeoReportType>('executive');
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setTab(tabFromQuery(params.get('tab')));
  }, []);

  const loadReport = useCallback(async (authToken: string, type: PortalSeoReportType) => {
    setLoading(true);
    setError('');
    try {
      const data = await portalSeoExecutiveReport(authToken, type);
      setReport(data.report);
      setGeneratedAt(data.generated_at);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Không tải được báo cáo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(token, tab);
  }, [token, tab, loadReport]);

  return (
    <>
      <p className="muted portal-module-meta">
        {generatedAt ? `Cập nhật ${generatedAt}` : 'Đang tải…'}
      </p>
      <SegmentedControl
        label="Loại báo cáo"
        value={tab}
        onChange={(next) => {
          setTab(next);
          router.replace(`/seo/reports?tab=${next}`, { scroll: false });
        }}
        options={REPORT_TABS.map((t) => ({ id: t.id, label: t.label }))}
      />
      {error ? <p className="error">{error}</p> : null}
      {loading ? (
        <p className="muted">Đang tải báo cáo…</p>
      ) : report ? (
        <ReportBody report={report} />
      ) : null}
    </>
  );
}
