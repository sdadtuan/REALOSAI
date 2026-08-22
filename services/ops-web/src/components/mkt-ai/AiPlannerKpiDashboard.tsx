'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AiOptimizationCopilot } from '@/components/mkt-ai/AiOptimizationCopilot';
import styles from '@/components/mkt-ai/mkt-ai-planner.module.css';
import {
  fetchMktAiDashboard,
  fetchMktAiKpiClosedLoop,
  type MktAiDashboardPayload,
  type MktAiKpiClosedLoopPayload,
} from '@/lib/mkt-ai-planner-api';

function fmtVnd(n: number): string {
  if (!n) return '—';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

function fmtCpl(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${Math.round(n / 1000)}k`;
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

interface Props {
  token: string;
  lifecycleId: number;
  stage: string;
  clientId?: string;
  canEdit?: boolean;
  closedLoopEnabled?: boolean;
}

export function AiPlannerKpiDashboard({
  token,
  lifecycleId,
  stage,
  clientId,
  canEdit = true,
  closedLoopEnabled = false,
}: Props) {
  const [data, setData] = useState<MktAiDashboardPayload | null>(null);
  const [closedLoop, setClosedLoop] = useState<MktAiKpiClosedLoopPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchMktAiDashboard(token, lifecycleId, { weeks: 6, channel: 'meta' });
      setData(out);
      if (closedLoopEnabled) {
        try {
          const loop = await fetchMktAiKpiClosedLoop(token, lifecycleId, { weeks: 6, channel: 'meta' });
          setClosedLoop(loop);
        } catch {
          setClosedLoop(null);
        }
      } else {
        setClosedLoop(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải dashboard thất bại');
      setData(null);
      setClosedLoop(null);
    } finally {
      setLoading(false);
    }
  }, [token, lifecycleId, closedLoopEnabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const emphasizeDeliver = stage === 'deliver' || stage === 'retain';

  if (loading && !data) {
    return (
      <div className={styles.skeleton} aria-busy="true" aria-label="Đang tải KPI dashboard">
        <div className={styles.skeletonBar} style={{ width: '60%' }} />
        <div className={styles.skeletonBar} style={{ width: '90%' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card stack-gap" style={{ padding: '1rem' }}>
        <p className="error" style={{ margin: 0 }}>{error}</p>
        <button type="button" className="btn btn-sm" onClick={() => void reload()}>
          Thử lại
        </button>
      </div>
    );
  }

  if (!data) return null;

  const agencyHref = data.agency_client_id
    ? `/agency/clients/${encodeURIComponent(data.agency_client_id)}?tab=performance`
    : clientId
      ? `/agency/clients/${encodeURIComponent(clientId)}?tab=performance`
      : null;

  const optimizeHref = `/crm/service-delivery/${lifecycleId}?tab=ai-planner&step=dashboard&sub=dashboard#optimize`;

  return (
    <div className="stack-gap">
      {emphasizeDeliver ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          KPI thực tế từ agency ingest — giai đoạn triển khai / giữ chân.
        </p>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
          Xem trước KPI — nhấn mạnh khi lifecycle ở stage deliver hoặc retain.
        </p>
      )}

      {closedLoopEnabled && closedLoop && closedLoop.alerts.length > 0 ? (
        <div className={styles.kpiAlertBanner} role="alert">
          <strong>{closedLoop.alerts.length} KPI lệch &gt;{closedLoop.threshold_pct}%</strong>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {' '}
            so target từ KPI tree đã Apply — mở Optimize copilot bên dưới.
          </span>
          <a href={optimizeHref} className="link" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
            Xem đề xuất →
          </a>
        </div>
      ) : null}

      {(data.messages.length > 0 || (closedLoop?.messages.length ?? 0) > 0) && (
        <ul className="muted" style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
          {data.messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
          {(closedLoop?.messages ?? []).map((m) => (
            <li key={`cl-${m}`}>{m}</li>
          ))}
        </ul>
      )}

      {!data.linked && (
        <p className="muted" style={{ margin: 0 }}>
          Liên kết hợp đồng với agency client để xem Spend / CPL / ROAS.
        </p>
      )}

      <div className={styles.kpiTileGrid}>
        <div className={styles.kpiTile}>
          <span className={styles.kpiTileLabel}>Spend MTD</span>
          <strong>{fmtVnd(data.tiles.spend_mtd_vnd)}</strong>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiTileLabel}>Leads</span>
          <strong>{data.tiles.leads_mtd || '—'}</strong>
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiTileLabel}>CPL</span>
          <strong>{fmtCpl(data.tiles.cpl_mtd)}</strong>
          {data.deltas.cpl_vs_target_pct != null && data.targets.cpl_vnd != null ? (
            <span className={styles.kpiDelta}>{fmtPct(data.deltas.cpl_vs_target_pct)} vs target</span>
          ) : null}
        </div>
        <div className={styles.kpiTile}>
          <span className={styles.kpiTileLabel}>
            ROAS{data.tiles.roas_stub ? ' (ước tính)' : ''}
          </span>
          <strong>{data.tiles.roas_mtd != null ? data.tiles.roas_mtd.toFixed(2) : '—'}</strong>
        </div>
      </div>

      {closedLoopEnabled && closedLoop && closedLoop.rows.length > 0 ? (
        <div>
          <h4 style={{ margin: '0 0 0.5rem' }}>Target (plan) vs Actual — KPI tree đã Apply</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>KPI</th>
                  <th>Target (plan)</th>
                  <th>Actual</th>
                  <th>Delta</th>
                </tr>
              </thead>
              <tbody>
                {closedLoop.rows.map((row) => (
                  <tr key={row.id} className={row.alert ? styles.kpiRowAlert : undefined}>
                    <td>{row.label}</td>
                    <td>{row.target_display}</td>
                    <td>{row.actual_display}</td>
                    <td>
                      {fmtPct(row.delta_pct)}
                      {row.alert ? ' ⚠' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : closedLoopEnabled && closedLoop && !closedLoop.has_applied_kpi_tree ? (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Closed-loop KPI: Apply TMMT sau khi hoàn thiện KPI tree để so sánh Target vs Actual.
        </p>
      ) : null}

      {data.deltas.spend_vs_prev_week_pct != null && (
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
          Spend tuần này {fmtPct(data.deltas.spend_vs_prev_week_pct)} so tuần trước.
        </p>
      )}

      <div>
        <h4 style={{ margin: '0 0 0.5rem' }}>Xu hướng {data.period.weeks} tuần</h4>
        {data.trend.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>Chưa có dữ liệu tuần.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Tuần</th>
                  <th>Spend</th>
                  <th>Leads</th>
                  <th>CPL</th>
                  <th>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {data.trend.map((row) => (
                  <tr key={row.week_start}>
                    <td>{row.week_label}</td>
                    <td>{fmtVnd(row.spend_vnd)}</td>
                    <td>{row.leads || '—'}</td>
                    <td>{fmtCpl(row.cpl)}</td>
                    <td>{row.roas != null ? row.roas.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {agencyHref ? (
        <p style={{ margin: 0 }}>
          <Link href={agencyHref} className="link">
            Mở Performance agency client →
          </Link>
        </p>
      ) : null}

      <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
        Kỳ: {data.period.month_start} → {data.period.to}
        {!data.flags.perf_tables_ready ? ' · PG performance chưa sẵn sàng' : ''}
      </p>

      <div id="optimize">
        <AiOptimizationCopilot token={token} lifecycleId={lifecycleId} canEdit={canEdit} />
      </div>
    </div>
  );
}
