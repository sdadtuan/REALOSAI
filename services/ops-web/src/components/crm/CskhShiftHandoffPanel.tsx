'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { fetchCskhShiftHandoff, type CskhShiftHandoffReport } from '@/lib/api';

interface Props {
  token: string;
}

export function CskhShiftHandoffPanel({ token }: Props) {
  const [report, setReport] = useState<CskhShiftHandoffReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchCskhShiftHandoff(token);
      setReport(out);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Không tải handoff report');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function copyMarkdown() {
    if (!report?.handoff_notes) return;
    try {
      await navigator.clipboard.writeText(report.handoff_notes);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Không copy được — chọn thủ công trong khung bên dưới.');
    }
  }

  if (loading) {
    return (
      <section className="cskh-shift-handoff cskh-shift-handoff--loading">
        <p className="muted">Đang tải báo cáo handoff cuối ca…</p>
      </section>
    );
  }

  if (error && !report) {
    return (
      <section className="cskh-shift-handoff">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!report) return null;

  const gatePass = report.breach_backlog.gate_pass;

  return (
    <section
      className={`cskh-shift-handoff banner ${gatePass ? 'banner-success' : 'banner-warning'}`}
      aria-label="Shift handoff report"
      data-testid="cskh-shift-handoff-panel"
    >
      <div className="cskh-shift-handoff__head">
        <div>
          <strong>Handoff cuối ca</strong>
          <p className="muted cskh-shift-handoff__sub">
            {report.shift.shift_label} · hết ca {report.shift.shift_end_ict} ICT · review queue{' '}
            {report.review_queue_pending} lead
            {report.review_queue_max_age_hours != null
              ? ` · max ${report.review_queue_max_age_hours}h`
              : ''}
          </p>
        </div>
        <div className="cskh-shift-handoff__actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => void reload()}>
            Làm mới
          </button>
          <button type="button" className="btn btn-sm" onClick={() => void copyMarkdown()}>
            {copied ? 'Đã copy' : 'Copy markdown'}
          </button>
        </div>
      </div>

      <div className="cskh-shift-handoff__metrics">
        <span className={gatePass ? 'success' : 'warning'}>
          Breach backlog {report.breach_backlog.backlog_count} ·{' '}
          {gatePass ? 'đạt gate' : 'chưa đạt gate cuối ca'}
        </span>
        <Link href="/crm/leads/review-queue" className="nav-link">
          Review queue →
        </Link>
        {!gatePass ? (
          <Link href="/crm/cskh-board?sla_filter=breach" className="nav-link">
            Bulk assign breach →
          </Link>
        ) : null}
      </div>

      <details className="cskh-shift-handoff__details">
        <summary className="muted">Xem markdown handoff</summary>
        <pre className="cskh-shift-handoff__markdown">{report.handoff_notes}</pre>
      </details>
    </section>
  );
}
