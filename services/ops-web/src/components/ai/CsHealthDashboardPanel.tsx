'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ChurnHealthClientView, ChurnRecoveryPlanEntry } from '@/lib/ai-api';
import {
  fetchChurnHealthDashboard,
  fetchChurnRecoveryPlans,
  postChurnRecoveryPlan,
  postChurnScore,
} from '@/lib/ai-api';

const BAND_LABELS: Record<string, string> = {
  healthy: 'Ổn định',
  watch: 'Theo dõi',
  at_risk: 'Rủi ro',
  critical: 'Nghiêm trọng',
};

function formatWhen(value: string): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString('vi-VN');
}

export function CsHealthDashboardPanel({ token }: { token: string }) {
  const [rows, setRows] = useState<ChurnHealthClientView[]>([]);
  const [total, setTotal] = useState(0);
  const [sort, setSort] = useState<'churn_risk' | 'score'>('churn_risk');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [ticketSpikeOnly, setTicketSpikeOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [timeline, setTimeline] = useState<ChurnRecoveryPlanEntry[]>([]);
  const [planClientId, setPlanClientId] = useState<string | null>(null);
  const [planNote, setPlanNote] = useState('');
  const [savingPlan, setSavingPlan] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashOut, timelineOut] = await Promise.all([
        fetchChurnHealthDashboard(token, {
          sort,
          order,
          ticket_spike: ticketSpikeOnly,
          limit: 100,
        }),
        fetchChurnRecoveryPlans(token, { limit: 20 }),
      ]);
      setRows(dashOut.data.clients);
      setTotal(dashOut.data.total);
      setTimeline(timelineOut.data.entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải dashboard health thất bại');
      setRows([]);
      setTotal(0);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  }, [token, sort, order, ticketSpikeOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleScan() {
    setScanning(true);
    setError('');
    try {
      await postChurnScore(token, { force: true, limit: 200 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chấm churn thất bại');
    } finally {
      setScanning(false);
    }
  }

  async function handleSavePlan() {
    if (!planClientId) return;
    const note = planNote.trim();
    if (!note) {
      setError('Nhập recovery plan trước khi lưu');
      return;
    }
    setSavingPlan(true);
    setError('');
    try {
      await postChurnRecoveryPlan(token, { client_id: planClientId, note });
      setPlanNote('');
      setPlanClientId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu recovery plan thất bại');
    } finally {
      setSavingPlan(false);
    }
  }

  return (
    <section className="cs-health-dashboard" data-testid="cs-health-dashboard">
      <div className="cs-health-dashboard__toolbar">
        <label>
          Sắp xếp
          <select value={sort} onChange={(e) => setSort(e.target.value as 'churn_risk' | 'score')}>
            <option value="churn_risk">Churn risk</option>
            <option value="score">Health score</option>
          </select>
        </label>
        <label>
          Thứ tự
          <select value={order} onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}>
            <option value="desc">Cao → thấp</option>
            <option value="asc">Thấp → cao</option>
          </select>
        </label>
        <label className="cs-health-dashboard__filter">
          <input
            type="checkbox"
            checked={ticketSpikeOnly}
            onChange={(e) => setTicketSpikeOnly(e.target.checked)}
          />
          Chỉ ticket spike
        </label>
        <button type="button" className="btn btn-secondary" disabled={scanning} onClick={() => void handleScan()}>
          {scanning ? 'Đang chấm…' : 'Chấm churn (batch)'}
        </button>
      </div>

      {error ? <p className="cs-health-dashboard__error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải…</p> : null}

      {!loading ? (
        <p className="muted cs-health-dashboard__meta">{total} client · UI-R3-04 · AI-UC-017 b6</p>
      ) : null}

      <div className="cs-health-dashboard__table-wrap">
        <table className="perf-table cs-health-table" data-testid="cs-health-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Score</th>
              <th>Churn risk</th>
              <th>Band</th>
              <th>Ticket spike</th>
              <th>Ticket mở</th>
              <th>Quá hạn TT</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.score_id} data-testid={`health-row-${row.client_id}`}>
                <td>
                  <strong>{row.client_name}</strong>
                  <div className="muted">{row.client_code}</div>
                </td>
                <td>{row.health.health_score}</td>
                <td>{row.health.churn_risk_pct}%</td>
                <td>
                  <span className={`health-band health-band--${row.health.health_band}`}>
                    {BAND_LABELS[row.health.health_band] ?? row.health.health_band}
                  </span>
                </td>
                <td>{row.health.ticket_spike ? 'Có' : '—'}</td>
                <td>{row.health.signals.tickets_open}</td>
                <td>{Math.round(row.health.signals.payment_overdue_vnd).toLocaleString('vi-VN')} ₫</td>
                <td>
                  <Link href={`/agency/clients/${row.client_id}?tab=health`} className="btn btn-link">
                    Chi tiết
                  </Link>
                  {' · '}
                  <button
                    type="button"
                    className="btn btn-link"
                    data-testid={`recovery-plan-open-${row.client_id}`}
                    onClick={() => {
                      setPlanClientId(row.client_id);
                      setPlanNote('');
                    }}
                  >
                    Recovery plan
                  </button>
                  {row.health.renewal_recommended ? (
                    <>
                      {' · '}
                      <Link href={`/agency/clients/${row.client_id}?tab=retain`} className="btn btn-link">
                        Retain
                      </Link>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">
                  Chưa có health score — chạy batch scan hoặc chờ cron nightly.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {planClientId ? (
        <div className="cs-health-recovery-form" data-testid="cs-health-recovery-form">
          <h4 className="kpi-section-title">Recovery plan</h4>
          <p className="muted">Client: {rows.find((row) => row.client_id === planClientId)?.client_name ?? planClientId}</p>
          <textarea
            value={planNote}
            onChange={(e) => setPlanNote(e.target.value)}
            rows={3}
            className="kpi-input cs-health-recovery-form__note"
            placeholder="Hành động phục hồi, owner, deadline…"
            data-testid="cs-health-recovery-note"
          />
          <div className="cs-health-recovery-form__actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={savingPlan}
              data-testid="cs-health-recovery-save"
              onClick={() => void handleSavePlan()}
            >
              {savingPlan ? 'Đang lưu…' : 'Lưu plan'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlanClientId(null)}>
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      <section className="cs-health-recovery-timeline" data-testid="cs-health-recovery-timeline">
        <h4 className="kpi-section-title">Recovery timeline ({timeline.length})</h4>
        {!timeline.length ? (
          <p className="muted">Chưa có recovery plan — AM log từ bảng trên.</p>
        ) : (
          <ul className="cs-health-recovery-timeline__list">
            {timeline.map((entry) => (
              <li key={entry.id} data-testid={`recovery-entry-${entry.id}`}>
                <strong>{entry.client_name}</strong>
                <span className="muted"> · {formatWhen(entry.created_at)}</span>
                <div>{entry.note}</div>
                <div className="muted">{entry.actor_name ?? entry.actor_id}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
