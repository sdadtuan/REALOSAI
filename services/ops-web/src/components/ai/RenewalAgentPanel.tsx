'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { RenewalOpportunityView } from '@/lib/ai-api';
import {
  fetchRenewalOpportunities,
  patchRenewalApprove,
  patchRenewalOutcome,
  postRenewalDraft,
} from '@/lib/ai-api';

const RISK_LABELS: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Mở',
  in_progress: 'Đang xử lý',
  renewed: 'Gia hạn',
  lost: 'Mất',
  deferred: 'Hoãn',
};

function formatVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + ' ₫';
}

export function RenewalAgentPanel({
  token,
  clientId,
  canWrite,
}: {
  token: string;
  clientId: string;
  canWrite: boolean;
}) {
  const [rows, setRows] = useState<RenewalOpportunityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [channels, setChannels] = useState<Record<string, 'email' | 'zalo'>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchRenewalOpportunities(token, clientId);
      setRows(out.data.opportunities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải renewal thất bại');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerateDraft(row: RenewalOpportunityView) {
    setBusyId(row.id);
    setError('');
    try {
      const channel = channels[row.id] ?? 'zalo';
      const out = await postRenewalDraft(token, row.id, channel);
      setDraftEdits((prev) => ({ ...prev, [row.id]: out.data.draft_text }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo draft thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(row: RenewalOpportunityView) {
    setBusyId(row.id);
    setError('');
    try {
      const text = draftEdits[row.id] ?? row.draft_text ?? '';
      await patchRenewalApprove(token, row.id, text);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt draft thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleOutcome(row: RenewalOpportunityView, outcome: 'renewed' | 'lost') {
    setBusyId(row.id);
    setError('');
    try {
      await patchRenewalOutcome(token, row.id, outcome);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật outcome thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="renewal-agent-panel" data-testid="renewal-agent-panel">
      <div className="renewal-agent-panel__head">
        <h3 className="kpi-section-title">Renewal Agent (RNOS-20)</h3>
        <p className="muted renewal-agent-panel__meta">
          T-90/60/30 trước ngày hết HĐ · Draft AM duyệt · Không auto-send
        </p>
      </div>

      {loading ? <p className="muted">Đang tải renewal…</p> : null}
      {error ? <p className="renewal-agent-panel__error">{error}</p> : null}

      {!loading && !rows.length ? (
        <p className="muted">Chưa có renewal opportunity — cron scan T-90/60/30 hoặc HĐ chưa có ngày hết hạn.</p>
      ) : null}

      <div className="renewal-agent-panel__cards">
        {rows.map((row) => {
          const draft = draftEdits[row.id] ?? row.draft_text ?? '';
          const channel = channels[row.id] ?? row.draft_channel ?? 'zalo';
          const closed = row.status === 'renewed' || row.status === 'lost';
          return (
            <article key={row.id} className="renewal-agent-card card" data-testid={`renewal-card-${row.id}`}>
              <header className="renewal-agent-card__head">
                <div>
                  <strong>{row.contract_title || `HĐ #${row.contract_id}`}</strong>
                  <p className="muted">
                    Hết hạn {row.renewal_date} · còn {row.days_until_end} ngày · T-{row.trigger_window}
                  </p>
                </div>
                <div className="renewal-agent-card__badges">
                  <span className={`renewal-badge renewal-badge--${row.risk_level}`}>
                    Risk: {RISK_LABELS[row.risk_level] ?? row.risk_level}
                  </span>
                  <span className="renewal-badge renewal-badge--status">{STATUS_LABELS[row.status] ?? row.status}</span>
                </div>
              </header>

              <div className="renewal-agent-card__health">
                <p>
                  Health score: <strong>{row.health.health_score}</strong> · Churn risk {row.health.churn_risk_pct}%
                </p>
                <ul className="ai-explain-chips">
                  {row.health.factors.slice(0, 4).map((f) => (
                    <li key={f.key}>{f.label}</li>
                  ))}
                </ul>
                <p className="muted">Giá trị HĐ: {formatVnd(row.amount_vnd)}</p>
              </div>

              {!closed && canWrite ? (
                <div className="renewal-agent-card__draft">
                  <label className="renewal-agent-card__channel">
                    Kênh draft
                    <select
                      value={channel}
                      onChange={(e) =>
                        setChannels((prev) => ({
                          ...prev,
                          [row.id]: e.target.value as 'email' | 'zalo',
                        }))
                      }
                      disabled={busyId === row.id || row.status === 'in_progress'}
                    >
                      <option value="zalo">Zalo</option>
                      <option value="email">Email</option>
                    </select>
                  </label>
                  <textarea
                    className="renewal-agent-card__textarea"
                    rows={6}
                    value={draft}
                    onChange={(e) => setDraftEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder="Generate renewal draft…"
                    data-testid={`renewal-draft-${row.id}`}
                  />
                  <div className="renewal-agent-card__actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === row.id || row.status === 'in_progress'}
                      onClick={() => void handleGenerateDraft(row)}
                    >
                      Generate draft
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === row.id || !draft.trim() || row.status === 'in_progress'}
                      onClick={() => void handleApprove(row)}
                      data-testid={`renewal-approve-${row.id}`}
                    >
                      Duyệt (no auto-send)
                    </button>
                  </div>
                </div>
              ) : null}

              {row.status === 'in_progress' ? (
                <p className="renewal-agent-card__approved muted">
                  Draft đã duyệt
                  {row.follow_up_task_id ? ` · task #${row.follow_up_task_id}` : ''}
                  {row.service_delivery_url ? (
                    <>
                      {' '}
                      ·{' '}
                      <Link href={row.service_delivery_url} className="nav-link">
                        Service delivery
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}

              {canWrite && !closed ? (
                <div className="renewal-agent-card__outcome">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === row.id}
                    onClick={() => void handleOutcome(row, 'renewed')}
                  >
                    Won / Renewed
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busyId === row.id}
                    onClick={() => void handleOutcome(row, 'lost')}
                  >
                    Lost
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
