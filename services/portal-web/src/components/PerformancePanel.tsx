'use client';

import { useCallback, useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/layout';
import { PortalAttributionFooter } from '@/components/PortalAttributionFooter';
import { PerformanceTable } from '@/components/PerformanceTable';
import {
  fetchPerformance,
  performanceExportUrl,
  type PerformanceChannel,
  type PerformanceListResponse,
} from '@/lib/api';
import { dateRangeEndingYesterday, fmtDate, fmtNumber, fmtPct, fmtVnd } from '@/lib/format';

type WindowDays = 7 | 30;
type GroupBy = 'day' | 'campaign';

export interface PerformancePanelProps {
  token: string;
  channel?: PerformanceChannel;
  title: string;
  subtitle?: string;
  hideChannelColumn?: boolean;
  embedded?: boolean;
}

export function PerformancePanel({
  token,
  channel,
  title,
  subtitle,
  hideChannelColumn = false,
  embedded = false,
}: PerformancePanelProps) {
  const [windowDays, setWindowDays] = useState<WindowDays>(7);
  const [groupBy, setGroupBy] = useState<GroupBy>('day');
  const [performance, setPerformance] = useState<PerformanceListResponse | null>(null);
  const [loadingPerf, setLoadingPerf] = useState(true);
  const [error, setError] = useState('');
  const [exportBusy, setExportBusy] = useState<'csv' | 'pdf' | null>(null);

  const loadPerformance = useCallback(
    async (authToken: string, days: WindowDays, group: GroupBy) => {
      setLoadingPerf(true);
      setError('');
      const range = dateRangeEndingYesterday(days);
      try {
        const data = await fetchPerformance(authToken, {
          from: range.from,
          to: range.to,
          group_by: group,
          channel,
        });
        setPerformance(data);
      } catch (err) {
        setPerformance(null);
        setError(err instanceof Error ? err.message : 'Không tải được performance');
      } finally {
        setLoadingPerf(false);
      }
    },
    [channel],
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadPerformance(token, windowDays, groupBy);
  }, [token, windowDays, groupBy, loadPerformance]);

  const summary = performance?.summary;
  const range = dateRangeEndingYesterday(windowDays);

  async function handleExport(format: 'csv' | 'pdf') {
    setExportBusy(format);
    setError('');
    try {
      const url = performanceExportUrl({
        from: range.from,
        to: range.to,
        group_by: groupBy,
        channel,
        format,
      });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        throw new Error(`Export ${format} failed (${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = format === 'pdf' ? 'portal-performance.pdf' : 'portal-performance.csv';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export thất bại');
    } finally {
      setExportBusy(null);
    }
  }

  const rootClass = embedded ? 'performance-panel performance-panel--embedded' : 'card performance-panel';

  return (
    <section className={rootClass}>
      <div className="performance-panel__head">
        <div className="performance-panel__intro">
          <h3 className="performance-panel__title">{title}</h3>
          {performance ? (
            <p className="muted performance-panel__meta">
              {subtitle ? `${subtitle} · ` : ''}
              {fmtDate(performance.date_from)} → {fmtDate(performance.date_to)} ·{' '}
              {summary?.campaigns_tracked ?? 0} chiến dịch
            </p>
          ) : null}
        </div>
        <div className="performance-panel__toolbar">
          <SegmentedControl
            label="Khoảng"
            value={windowDays === 7 ? 't7' : 't30'}
            onChange={(value) => setWindowDays(value === 't7' ? 7 : 30)}
            options={[
              { id: 't7', label: 'T-7' },
              { id: 't30', label: 'T-30' },
            ]}
          />
          <SegmentedControl
            label="Nhóm"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { id: 'day', label: 'Theo ngày' },
              { id: 'campaign', label: 'Theo chiến dịch' },
            ]}
          />
          <div className="performance-panel__exports">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={exportBusy !== null || loadingPerf}
              onClick={() => void handleExport('csv')}
            >
              {exportBusy === 'csv' ? 'Đang export…' : 'Export CSV'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={exportBusy !== null || loadingPerf}
              onClick={() => void handleExport('pdf')}
            >
              {exportBusy === 'pdf' ? 'Đang export…' : 'PDF (stub)'}
            </button>
          </div>
        </div>
      </div>

      {summary ? (
        <div className="kpi-tile-grid performance-panel__summary">
          <div className="kpi-tile">
            <p className="kpi-tile__label">Tổng spend</p>
            <p className="kpi-tile__value">{fmtVnd(summary.total_spend)}</p>
          </div>
          <div className="kpi-tile">
            <p className="kpi-tile__label">Leads CRM</p>
            <p className="kpi-tile__value">{fmtNumber(summary.total_leads_crm)}</p>
          </div>
          <div className="kpi-tile">
            <p className="kpi-tile__label">CPL trung bình</p>
            <p className="kpi-tile__value">{summary.avg_cpl != null ? fmtVnd(summary.avg_cpl) : '—'}</p>
          </div>
          <div className={`kpi-tile${summary.over_target_rows > 0 ? ' kpi-tile--critical' : ''}`}>
            <p className="kpi-tile__label">Vượt target CPL</p>
            <p className="kpi-tile__value">{fmtNumber(summary.over_target_rows)} hàng</p>
          </div>
          <div className="kpi-tile">
            <p className="kpi-tile__label">Chiến dịch tracked</p>
            <p className="kpi-tile__value">{fmtNumber(summary.campaigns_tracked)}</p>
          </div>
          {performance.unmapped_spend_pct != null ? (
            <div className="kpi-tile">
              <p className="kpi-tile__label">Unmapped spend</p>
              <p className="kpi-tile__value">{fmtPct(performance.unmapped_spend_pct)}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {loadingPerf ? (
        <p className="muted">Đang tải performance…</p>
      ) : performance && performance.rows.length === 0 ? (
        <div className="portal-empty-state">
          <p className="portal-empty-state__title">Chưa có dữ liệu trong khoảng T-{windowDays}</p>
          <p className="muted portal-empty-state__hint">
            Insights có thể chưa sync hoặc chưa map Hub campaign. Liên hệ AM nếu cần hỗ trợ.
          </p>
        </div>
      ) : performance ? (
        <>
          <PerformanceTable
            rows={performance.rows}
            groupBy={performance.group_by}
            hideChannel={hideChannelColumn}
          />
          <PortalAttributionFooter performance={performance} />
        </>
      ) : null}
    </section>
  );
}
