'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { AiAgentRunRow, AiAgentRunStatus } from '@/lib/ai-api';

const STATUS_OPTIONS: Array<{ value: '' | AiAgentRunStatus; label: string }> = [
  { value: '', label: 'Tất cả' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'cancelled', label: 'Cancelled' },
];

function statusClass(status: AiAgentRunStatus): string {
  if (status === 'succeeded') return 'ai-run-status ai-run-status--ok';
  if (status === 'failed') return 'ai-run-status ai-run-status--fail';
  if (status === 'running') return 'ai-run-status ai-run-status--run';
  return 'ai-run-status ai-run-status--muted';
}

function formatWhen(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 19);
  return d.toLocaleString('vi-VN');
}

function formatLatency(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return '—';
  return `${Math.round(ms)} ms`;
}

export interface AdminAiRunsFilters {
  from: string;
  to: string;
  status: '' | AiAgentRunStatus;
  useCase: string;
}

export function AdminAiRunsPanel({
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
  rows: AiAgentRunRow[];
  total: number;
  limit: number;
  offset: number;
  filters: AdminAiRunsFilters;
  loading: boolean;
  selected: AiAgentRunRow | null;
  detail: AiAgentRunRow | null;
  detailLoading: boolean;
  onFiltersChange: (patch: Partial<AdminAiRunsFilters>) => void;
  onApplyFilters: () => void;
  onSelectRow: (row: AiAgentRunRow) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}) {
  const pageInfo = useMemo(() => {
    if (total === 0) return '0 kết quả';
    const from = offset + 1;
    const to = Math.min(offset + limit, total);
    return `${from}–${to} / ${total}`;
  }, [offset, limit, total]);

  return (
    <section className="admin-ai-runs-panel">
      <div className="admin-ai-runs-panel__filters">
        <label>
          <span className="muted">Từ ngày</span>
          <input
            type="date"
            className="kpi-input"
            value={filters.from}
            onChange={(e) => onFiltersChange({ from: e.target.value })}
          />
        </label>
        <label>
          <span className="muted">Đến ngày</span>
          <input
            type="date"
            className="kpi-input"
            value={filters.to}
            onChange={(e) => onFiltersChange({ to: e.target.value })}
          />
        </label>
        <label>
          <span className="muted">Status</span>
          <select
            className="kpi-input"
            value={filters.status}
            onChange={(e) => onFiltersChange({ status: e.target.value as AdminAiRunsFilters['status'] })}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="muted">Use case</span>
          <input
            type="text"
            className="kpi-input"
            placeholder="score_lead, summarize…"
            value={filters.useCase}
            onChange={(e) => onFiltersChange({ useCase: e.target.value })}
          />
        </label>
        <button type="button" className="btn btn-primary" onClick={onApplyFilters} disabled={loading}>
          Lọc
        </button>
      </div>

      <p className="muted admin-ai-runs-panel__meta">
        {loading ? 'Đang tải…' : pageInfo} · BR-AI-05 redaction khi prod không lưu raw prompt
      </p>

      <div className="perf-table-wrap">
        <table className="perf-table admin-ai-runs-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Agent</th>
              <th>Use case</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Actor</th>
              <th>Model</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  Không có agent run trong khoảng lọc.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.id ? 'admin-ai-runs-table__row--active' : undefined}
                  onClick={() => onSelectRow(row)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{formatWhen(row.started_at)}</td>
                  <td>{row.agent_name}</td>
                  <td>{row.use_case ?? '—'}</td>
                  <td>
                    <span className={statusClass(row.status)}>{row.status}</span>
                  </td>
                  <td>{formatLatency(row.latency_ms)}</td>
                  <td>{row.actor_id ?? '—'}</td>
                  <td>{row.model_name ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-ai-runs-panel__pager">
        <button type="button" className="btn btn-secondary" disabled={offset <= 0 || loading} onClick={onPrevPage}>
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

      {selected ? (
        <section className="admin-ai-runs-detail card" style={{ padding: '0.85rem', marginTop: '1rem' }}>
          <h3 className="kpi-section-title">Chi tiết run</h3>
          {detailLoading ? <p className="muted">Đang tải chi tiết…</p> : null}
          {detail ? (
            <>
              <ul className="kpi-kv-list">
                <li>
                  <span>Run ID</span>
                  <strong>{detail.id}</strong>
                </li>
                <li>
                  <span>Prompt hash</span>
                  <strong>{detail.prompt_hash ?? '—'}</strong>
                </li>
                <li>
                  <span>Correlation</span>
                  <strong>{detail.correlation_id ?? '—'}</strong>
                </li>
                {detail.orchestration_id ? (
                  <li>
                    <span>Orchestration</span>
                    <strong>
                      <Link href={`/admin/ai/agents?id=${encodeURIComponent(detail.orchestration_id)}`}>
                        {detail.orchestration_id}
                      </Link>
                    </strong>
                  </li>
                ) : null}
                <li>
                  <span>Prompt visible</span>
                  <strong>{detail.prompt_visible ? 'Yes (non-prod)' : 'Redacted'}</strong>
                </li>
                {detail.error_message ? (
                  <li>
                    <span>Error</span>
                    <strong className="error">{detail.error_message}</strong>
                  </li>
                ) : null}
              </ul>
              <details className="admin-ai-runs-detail__json">
                <summary>Input / output JSON</summary>
                <pre>{JSON.stringify({ input_json: detail.input_json, output_json: detail.output_json }, null, 2)}</pre>
              </details>
            </>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
