'use client';

import { useMemo } from 'react';
import { formatPct, formatVnd } from '@/lib/kpi/format';
import type { ForecastMapeReportData } from '@/lib/ai-api';

function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function buildMapeReportCsv(report: ForecastMapeReportData): string {
  const header = [
    'period',
    'committed_vnd',
    'actual_vnd',
    'variance_vnd',
    'mape_pct',
    'warn',
    'committed_by',
    'committed_at',
  ];
  const lines = report.rows.map((row) =>
    [
      row.period_label,
      row.committed_vnd,
      row.actual_vnd,
      row.variance_vnd,
      row.mape_pct ?? '',
      row.warn ? 'yes' : 'no',
      row.committed_by ?? '',
      row.committed_at ?? '',
    ]
      .map(csvEscape)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export function ForecastMapeReportPanel({ report }: { report: ForecastMapeReportData | null }) {
  const csvHref = useMemo(() => {
    if (!report?.rows.length) return null;
    const blob = new Blob([buildMapeReportCsv(report)], { type: 'text/csv;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [report]);

  if (!report) {
    return (
      <section className="kpi-page__section forecast-mape-report" data-testid="forecast-mape-report">
        <h3 className="kpi-section-title">MAPE report (leadership)</h3>
        <p className="muted">Chưa tải được báo cáo MAPE — §19.3 #2.</p>
      </section>
    );
  }

  return (
    <section className="kpi-page__section forecast-mape-report" data-testid="forecast-mape-report">
      <div className="forecast-mape-report__head">
        <div>
          <h3 className="kpi-section-title">MAPE report · {report.months} tháng</h3>
          <p className="muted forecast-mape-report__meta">
            Target ≤{formatPct(report.target_mape_pct)} · TB{' '}
            {report.summary.avg_mape_pct != null ? formatPct(report.summary.avg_mape_pct) : '—'} ·{' '}
            {report.summary.months_over_target} tháng vượt ngưỡng
          </p>
        </div>
        {csvHref ? (
          <a
            href={csvHref}
            download={`mape-report-${report.generated_at.slice(0, 10)}.csv`}
            className="btn btn-secondary btn-sm"
            data-testid="forecast-mape-export"
          >
            Export CSV
          </a>
        ) : null}
      </div>
      <div className="ai-insights-table-wrap">
        <table className="ai-insights-table">
          <thead>
            <tr>
              <th>Kỳ</th>
              <th>Cam kết</th>
              <th>Thực thu</th>
              <th>Chênh</th>
              <th>MAPE</th>
              <th>Chốt bởi</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={`${row.year}-${row.month}`} data-testid={`mape-row-${row.year}-${row.month}`}>
                <td>{row.period_label}</td>
                <td>{formatVnd(row.committed_vnd)}</td>
                <td>{formatVnd(row.actual_vnd)}</td>
                <td>{formatVnd(row.variance_vnd)}</td>
                <td>
                  {row.mape_pct != null ? formatPct(row.mape_pct) : '—'}
                  {row.warn ? ' ⚠' : ''}
                </td>
                <td>{row.committed_by ?? '—'}</td>
              </tr>
            ))}
            {!report.rows.length ? (
              <tr>
                <td colSpan={6} className="muted">
                  Chưa có tháng nào có cam kết forecast.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
