'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { HubPageLayout } from '@/components/layout';
import { PortalPageShell } from '@/components/PortalPageShell';
import { portalResearchReport, portalResearchReportPdf, type PortalResearchReportDetail } from '@/lib/api';
import { isMarketResearchPortalFeEnabled } from '@/lib/market-research-portal-flags';
import { portalResearchErrorVi } from '@/lib/portal-research-errors';
import { reportRowIsStale } from '@/lib/insight-stale.util';
import { publishedValidToFromRow } from '@/lib/published-valid-to.util';
import { PortalInsightStaleBanner } from '@/components/PortalInsightStaleBanner';
import { PublishedValidToNote } from '@/components/PublishedValidToNote';

export default function PortalResearchDetailPage() {
  return (
    <PortalPageShell
      breadcrumb={[
        { label: 'Client Portal', href: '/dashboard' },
        { label: 'Nghiên cứu', href: '/research' },
        { label: 'Báo cáo' },
      ]}
    >
      {({ token }) => <ResearchDetailContent token={token} />}
    </PortalPageShell>
  );
}

function asText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    return String(
      rec.heading ?? rec.statement ?? rec.recommendation ?? rec.text ?? rec.locator ?? '',
    );
  }
  return '';
}

function methodologyText(raw: unknown): string {
  if (raw == null) return '—';
  if (typeof raw === 'string') return raw || '—';
  if (typeof raw === 'object') {
    const m = raw as Record<string, unknown>;
    const parts = [m.population, m.source_plan, m.limitation]
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean);
    if (parts.length) return parts.join(' · ');
    if (m.stub) return 'P0 CB methodology stub';
  }
  return '—';
}

function ResearchDetailContent({ token }: { token: string }) {
  const params = useParams<{ versionId: string }>();
  const versionId = Number.parseInt(String(params.versionId ?? ''), 10);
  const [report, setReport] = useState<PortalResearchReportDetail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (!isMarketResearchPortalFeEnabled()) {
      setLoading(false);
      return;
    }
    if (!Number.isFinite(versionId)) {
      setError(portalResearchErrorVi('not_found'));
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      setError('');
      try {
        setReport(await portalResearchReport(token, versionId));
      } catch (err) {
        setReport(null);
        setError(portalResearchErrorVi(err instanceof Error ? err.message : ''));
      } finally {
        setLoading(false);
      }
    })();
  }, [token, versionId]);

  async function handleDownloadPdf() {
    if (!report) return;
    setPdfBusy(true);
    setError('');
    try {
      const blob = await portalResearchReportPdf(token, report.version_id);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `research-v${report.version}.pdf`;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(portalResearchErrorVi(err instanceof Error ? err.message : ''));
    } finally {
      setPdfBusy(false);
    }
  }

  if (!isMarketResearchPortalFeEnabled()) {
    return (
      <HubPageLayout title="Nghiên cứu" subtitle="Báo cáo đã công bố">
        <p className="muted">Nghiên cứu thị trường chưa bật.</p>
      </HubPageLayout>
    );
  }

  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const recs = Array.isArray(report?.recs) ? report.recs : [];
  const evidence = Array.isArray(report?.evidence_index) ? report.evidence_index : [];
  const methodology = report?.methodology;

  return (
    <HubPageLayout
      title="Báo cáo nghiên cứu"
      subtitle={report ? `Phiên bản ${report.version}` : 'Chỉ xem'}
      actions={
        <>
          {report ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pdfBusy}
              onClick={() => void handleDownloadPdf()}
            >
              Tải PDF
            </button>
          ) : null}
          <Link href="/research" className="btn btn-secondary btn-sm">
            ← Danh sách
          </Link>
        </>
      }
    >
      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải…</p> : null}
      {report ? (
        <div className="research-report-watermark" data-watermark={report.watermark}>
          <div className="research-report-watermark__repeat" aria-hidden="true">
            {Array.from({ length: 18 }, (_, i) => (
              <span key={i}>{report.watermark}</span>
            ))}
          </div>
          <div className="research-report-body">
            <p className="muted portal-module-meta">
              {report.as_of ? `As of ${report.as_of}` : 'As of —'}
              {report.expires_at ? ` · Hết hạn ${report.expires_at}` : ''}
            </p>
            <section className="portal-hub-section">
              <h3 className="portal-hub-section__title">Tóm tắt điều hành</h3>
              <p>{report.exec.vi || '—'}</p>
              {report.exec.en ? <p>{report.exec.en}</p> : null}
            </section>
            <section className="portal-hub-section">
              <h3 className="portal-hub-section__title">Phát hiện</h3>
              {findings.length === 0 ? (
                <p className="muted">—</p>
              ) : (
                <ul className="portal-list">
                  {findings.map((row, i) => (
                    <li key={i}>
                      {asText(row) || '—'}
                      {row && typeof row === 'object' && reportRowIsStale(row as { is_stale?: boolean; valid_to?: string | null }) ? (
                        <PortalInsightStaleBanner
                          validTo={(row as { valid_to?: string | null }).valid_to}
                        />
                      ) : null}
                      <PublishedValidToNote publishedValidTo={publishedValidToFromRow(row)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="portal-hub-section">
              <h3 className="portal-hub-section__title">Khuyến nghị</h3>
              {recs.length === 0 ? (
                <p className="muted">—</p>
              ) : (
                <ul className="portal-list">
                  {recs.map((row, i) => (
                    <li key={i}>
                      {asText(row) || '—'}
                      {row && typeof row === 'object' && reportRowIsStale(row as { is_stale?: boolean; valid_to?: string | null }) ? (
                        <PortalInsightStaleBanner
                          validTo={(row as { valid_to?: string | null }).valid_to}
                        />
                      ) : null}
                      <PublishedValidToNote publishedValidTo={publishedValidToFromRow(row)} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="portal-hub-section">
              <h3 className="portal-hub-section__title">Phương pháp</h3>
              <p>{methodologyText(methodology)}</p>
            </section>
            <section className="portal-hub-section">
              <h3 className="portal-hub-section__title">Chỉ mục bằng chứng</h3>
              {evidence.length === 0 ? (
                <p className="muted">—</p>
              ) : (
                <ul className="portal-list">
                  {evidence.map((row, i) => (
                    <li key={i}>{asText(row) || '—'}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </HubPageLayout>
  );
}
