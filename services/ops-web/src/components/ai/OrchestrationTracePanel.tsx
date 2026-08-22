'use client';

import { useMemo } from 'react';
import { AgentRunTree } from '@/components/ai/AgentRunTree';
import type {
  AiOrchestration,
  AiOrchestrationStatus,
  OrchestrationDetail,
} from '@/lib/ai-api';

const STATUS_OPTIONS: Array<{ value: '' | AiOrchestrationStatus; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'cancelled', label: 'Cancelled' },
];

export interface OrchestrationFilters {
  from: string;
  to: string;
  planKey: string;
  status: '' | AiOrchestrationStatus;
}

function statusClass(status: AiOrchestrationStatus): string {
  if (status === 'succeeded') return 'ai-run-status ai-run-status--ok';
  if (status === 'failed') return 'ai-run-status ai-run-status--fail';
  if (status === 'running') return 'ai-run-status ai-run-status--run';
  return 'ai-run-status ai-run-status--muted';
}

function formatWhen(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19);
  return d.toLocaleString('vi-VN');
}

function formatDuration(row: AiOrchestration): string {
  const started = new Date(row.started_at).getTime();
  const ended = row.ended_at ? new Date(row.ended_at).getTime() : Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended < started) return '—';
  const ms = ended - started;
  if (ms < 1_000) return `${ms} ms`;
  return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

const PLAN_KEY_LABELS: Record<string, string> = {
  cpl_weekly_v1: 'WIN-4-C · CPL weekly + budget',
  lead_intake_v1: 'Lead intake',
  retain_health_renewal_v1: 'Retain health · renewal',
  retain_health_client_v1: 'Retain health · client',
};

function formatPlanKey(planKey: string): string {
  return PLAN_KEY_LABELS[planKey] ? `${planKey} (${PLAN_KEY_LABELS[planKey]})` : planKey;
}

export function OrchestrationTracePanel({
  rows,
  total,
  limit,
  offset,
  filters,
  loading,
  selected,
  detail,
  detailLoading,
  onFiltersChange,
  onApplyFilters,
  onSelectRow,
  onPrevPage,
  onNextPage,
}: {
  rows: AiOrchestration[];
  total: number;
  limit: number;
  offset: number;
  filters: OrchestrationFilters;
  loading: boolean;
  selected: AiOrchestration | null;
  detail: OrchestrationDetail | null;
  detailLoading: boolean;
  onFiltersChange: (patch: Partial<OrchestrationFilters>) => void;
  onApplyFilters: () => void;
  onSelectRow: (row: AiOrchestration) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const pageInfo = useMemo(() => {
    if (total === 0) return '0 kết quả';
    return `${offset + 1}–${Math.min(offset + limit, total)} / ${total}`;
  }, [limit, offset, total]);

  return (
    <section className="orchestration-trace-panel">
      <div className="admin-ai-runs-panel__filters">
        <label>
          <span className="muted">Từ ngày</span>
          <input
            type="date"
            className="kpi-input"
            value={filters.from}
            onChange={(event) => onFiltersChange({ from: event.target.value })}
          />
        </label>
        <label>
          <span className="muted">Đến ngày</span>
          <input
            type="date"
            className="kpi-input"
            value={filters.to}
            onChange={(event) => onFiltersChange({ to: event.target.value })}
          />
        </label>
        <label>
          <span className="muted">Plan key</span>
          <input
            type="text"
            className="kpi-input"
            placeholder="lead_intake_v1"
            value={filters.planKey}
            onChange={(event) => onFiltersChange({ planKey: event.target.value })}
          />
        </label>
        <label>
          <span className="muted">Status</span>
          <select
            className="kpi-input"
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({ status: event.target.value as OrchestrationFilters['status'] })
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={onApplyFilters} disabled={loading}>
          Lọc
        </button>
      </div>

      <p className="muted admin-ai-runs-panel__meta">{loading ? 'Đang tải…' : pageInfo}</p>

      <div className="orchestration-trace-panel__split">
        <div className="orchestration-trace-panel__list">
          <div className="perf-table-wrap">
            <table className="perf-table orchestration-trace-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Client</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Không có orchestration trong khoảng lọc.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        selected?.id === row.id ? 'admin-ai-runs-table__row--active' : undefined
                      }
                      onClick={() => onSelectRow(row)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <strong>{formatPlanKey(row.plan_key)}</strong>
                        <span className="muted orchestration-trace-table__when">
                          {formatWhen(row.started_at)}
                        </span>
                      </td>
                      <td>
                        {row.trigger_type}
                        {row.trigger_ref ? ` · ${row.trigger_ref}` : ''}
                      </td>
                      <td>
                        <span className={statusClass(row.status)}>{row.status}</span>
                      </td>
                      <td>{formatDuration(row)}</td>
                      <td>{row.client_id ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="admin-ai-runs-panel__pager">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={offset <= 0 || loading}
              onClick={onPrevPage}
            >
              ← Trước
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={offset + limit >= total || loading}
              onClick={onNextPage}
            >
              Sau →
            </button>
          </div>
        </div>

        <section className="orchestration-trace-panel__detail" aria-live="polite">
          <h3 className="kpi-section-title">Orchestration trace</h3>
          {!selected ? <p className="muted">Chọn một orchestration để xem cây agent run.</p> : null}
          {detailLoading ? <p className="muted">Đang tải trace…</p> : null}
          {detail ? (
            <>
              <ul className="kpi-kv-list">
                <li>
                  <span>Orchestration ID</span>
                  <strong>{detail.orchestration.id}</strong>
                </li>
                <li>
                  <span>Plan</span>
                  <strong>{formatPlanKey(detail.orchestration.plan_key)}</strong>
                </li>
                <li>
                  <span>Correlation</span>
                  <strong>{detail.orchestration.correlation_id ?? '—'}</strong>
                </li>
              </ul>
              <AgentRunTree parentRun={detail.parentRun} children={detail.children} />
            </>
          ) : null}
        </section>
      </div>
    </section>
  );
}
