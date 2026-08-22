'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { UpsellSuggestionView } from '@/lib/ai-api';
import {
  fetchUpsellSuggestions,
  patchUpsellApprove,
  patchUpsellDismiss,
  postUpsellSuggest,
} from '@/lib/ai-api';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  accepted: 'Đã duyệt',
  dismissed: 'Đã bỏ qua',
};

export function UpsellAgentPanel({
  token,
  clientId,
  canWrite,
}: {
  token: string;
  clientId: string;
  canWrite: boolean;
}) {
  const [rows, setRows] = useState<UpsellSuggestionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchUpsellSuggestions(token, clientId);
      setRows(out.data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải upsell thất bại');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSuggest(force = false) {
    setBusyId('scan');
    setError('');
    try {
      await postUpsellSuggest(token, clientId, { force, limit: 3 });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gợi ý upsell thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleApprove(row: UpsellSuggestionView) {
    setBusyId(row.id);
    setError('');
    try {
      const text = draftEdits[row.id] ?? row.draft_text ?? '';
      await patchUpsellApprove(token, row.id, text);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duyệt upsell thất bại');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismiss(row: UpsellSuggestionView) {
    setBusyId(row.id);
    setError('');
    try {
      await patchUpsellDismiss(token, row.id, 'dismissed_by_am');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bỏ qua upsell thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="renewal-agent-panel upsell-agent-panel" data-testid="upsell-agent-panel">
      <div className="renewal-agent-panel__head">
        <h3 className="kpi-section-title">Upsell Agent (RNOS-27)</h3>
        <p className="muted renewal-agent-panel__meta">
          KH healthy + lifecycle active · Cross-sell add-on · AM duyệt · Không auto-send
        </p>
      </div>

      {canWrite ? (
        <div className="renewal-agent-card__actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busyId === 'scan'}
            onClick={() => void handleSuggest(false)}
            data-testid="upsell-suggest-btn"
          >
            Gợi ý upsell
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busyId === 'scan'}
            onClick={() => void handleSuggest(true)}
          >
            Regenerate (force)
          </button>
        </div>
      ) : null}

      {loading ? <p className="muted">Đang tải upsell…</p> : null}
      {error ? <p className="renewal-agent-panel__error">{error}</p> : null}

      {!loading && !rows.length ? (
        <p className="muted">Chưa có gợi ý upsell — bấm &quot;Gợi ý upsell&quot; khi KH có lifecycle active và health ≥ 55.</p>
      ) : null}

      <div className="renewal-agent-panel__cards">
        {rows.map((row) => {
          const draft = draftEdits[row.id] ?? row.draft_text ?? '';
          const closed = row.status === 'accepted' || row.status === 'dismissed';
          return (
            <article key={row.id} className="renewal-agent-card card" data-testid={`upsell-card-${row.id}`}>
              <header className="renewal-agent-card__head">
                <div>
                  <strong>
                    {row.source_service_label} → {row.target_service_label}
                  </strong>
                  <p className="muted">{row.reason}</p>
                </div>
                <div className="renewal-agent-card__badges">
                  <span className="renewal-badge renewal-badge--status">
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                  <span className="renewal-badge renewal-badge--low">
                    Confidence {Math.round(row.confidence * 100)}%
                  </span>
                  {row.health_score != null ? (
                    <span className="renewal-badge renewal-badge--medium">Health {row.health_score}</span>
                  ) : null}
                </div>
              </header>

              {!closed && canWrite ? (
                <div className="renewal-agent-card__draft">
                  <textarea
                    className="renewal-agent-card__textarea"
                    rows={6}
                    value={draft}
                    onChange={(e) => setDraftEdits((prev) => ({ ...prev, [row.id]: e.target.value }))}
                    placeholder="Draft upsell…"
                    data-testid={`upsell-draft-${row.id}`}
                  />
                  <div className="renewal-agent-card__actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === row.id || !draft.trim()}
                      onClick={() => void handleApprove(row)}
                      data-testid={`upsell-approve-${row.id}`}
                    >
                      Duyệt (no auto-send)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === row.id}
                      onClick={() => void handleDismiss(row)}
                    >
                      Bỏ qua
                    </button>
                  </div>
                </div>
              ) : null}

              {row.status === 'accepted' ? (
                <p className="renewal-agent-card__approved muted">
                  Upsell đã duyệt
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
            </article>
          );
        })}
      </div>
    </section>
  );
}
