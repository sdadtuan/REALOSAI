'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { PipelineRiskDealRow } from '@/lib/ai-api';
import type { CrmStaffRow } from '@/lib/api';

const SCORE_BAND_LABELS: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
};

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export function PipelineRiskPanel({
  rows,
  total,
  lastScanAt,
  staffOptions = [],
  onAssignOwner,
  onLogActivity,
}: {
  rows: PipelineRiskDealRow[];
  total: number;
  lastScanAt: string | null;
  staffOptions?: CrmStaffRow[];
  onAssignOwner?: (recommendationId: string, staffId: number, staffName: string) => Promise<void>;
  onLogActivity?: (recommendationId: string, note: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activityNotes, setActivityNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function handleAssign(recommendationId: string, staffId: number) {
    if (!onAssignOwner) return;
    const staff = staffOptions.find((row) => row.id === staffId);
    if (!staff) return;
    setBusyId(recommendationId);
    setError('');
    try {
      await onAssignOwner(recommendationId, staffId, staff.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gán owner thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivity(recommendationId: string) {
    if (!onLogActivity) return;
    const note = (activityNotes[recommendationId] ?? '').trim();
    if (!note) {
      setError('Nhập ghi chú activity trước khi clear risk');
      return;
    }
    setBusyId(recommendationId);
    setError('');
    try {
      await onLogActivity(recommendationId, note);
      setActivityNotes((prev) => ({ ...prev, [recommendationId]: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Log activity thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="ai-insights-page__section pipeline-risk-panel" data-testid="pipeline-risk-panel">
      <div className="pipeline-risk-panel__head">
        <h3 className="kpi-section-title">At-risk deals ({total})</h3>
        {lastScanAt ? (
          <p className="muted pipeline-risk-panel__meta">Lần quét gần nhất: {formatWhen(lastScanAt)}</p>
        ) : (
          <p className="muted pipeline-risk-panel__meta">Chưa có lần quét — cron RNOS-23 chạy hàng ngày.</p>
        )}
      </div>

      {error ? <p className="error">{error}</p> : null}

      {!rows.length ? (
        <p className="muted">Không có deal at-risk (≥7 ngày không activity).</p>
      ) : (
        <div className="ai-insights-table-wrap">
          <table className="ai-insights-table">
            <thead>
              <tr>
                <th>Deal</th>
                <th>Stage</th>
                <th>Đứng im</th>
                <th>Owner</th>
                <th>Follow-up</th>
                <th>Clear risk</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.recommendation_id} data-testid={`pipeline-risk-row-${row.deal_id}`}>
                  <td>
                    <Link href={`/crm/sales?deal_id=${row.deal_id}`} className="pipeline-risk-panel__deal-link">
                      {row.title}
                    </Link>
                    <div className="muted">
                      {SCORE_BAND_LABELS[row.score_band] ?? row.score_band} · {row.deal_score} · {row.stalled_days} ngày
                    </div>
                  </td>
                  <td>{row.pipeline_stage || '—'}</td>
                  <td>{row.stalled_days} ngày</td>
                  <td>
                    {row.follow_up_owner_name ? (
                      <span data-testid={`pipeline-risk-owner-${row.deal_id}`}>{row.follow_up_owner_name}</span>
                    ) : (
                      <span className="muted">Chưa gán</span>
                    )}
                    {onAssignOwner && staffOptions.length ? (
                      <select
                        className="kpi-select pipeline-risk-panel__assign"
                        defaultValue=""
                        disabled={busyId === row.recommendation_id}
                        aria-label={`Gán owner deal ${row.title}`}
                        data-testid={`pipeline-risk-assign-${row.deal_id}`}
                        onChange={(e) => {
                          const staffId = Number(e.target.value);
                          if (staffId > 0) void handleAssign(row.recommendation_id, staffId);
                          e.target.value = '';
                        }}
                      >
                        <option value="">Gán owner…</option>
                        {staffOptions.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                  <td>
                    <Link href={`/crm/sales?deal_id=${row.deal_id}`} className="btn btn-link btn-sm">
                      Mở deal
                    </Link>
                  </td>
                  <td>
                    {onLogActivity ? (
                      <div className="pipeline-risk-panel__activity">
                        <input
                          type="text"
                          value={activityNotes[row.recommendation_id] ?? ''}
                          placeholder="Ghi chú activity…"
                          className="kpi-input"
                          disabled={busyId === row.recommendation_id}
                          data-testid={`pipeline-risk-note-${row.deal_id}`}
                          onChange={(e) =>
                            setActivityNotes((prev) => ({ ...prev, [row.recommendation_id]: e.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busyId === row.recommendation_id}
                          data-testid={`pipeline-risk-clear-${row.deal_id}`}
                          onClick={() => void handleActivity(row.recommendation_id)}
                        >
                          Log & clear
                        </button>
                      </div>
                    ) : (
                      <span className="muted">{formatWhen(row.scanned_at)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
