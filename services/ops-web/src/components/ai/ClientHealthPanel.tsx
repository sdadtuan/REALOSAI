'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ChurnHealthClientView } from '@/lib/ai-api';
import { fetchClientChurnHealth, postChurnScore } from '@/lib/ai-api';

const BAND_LABELS: Record<string, string> = {
  healthy: 'Ổn định',
  watch: 'Theo dõi',
  at_risk: 'Rủi ro',
  critical: 'Nghiêm trọng',
};

const RISK_LABELS: Record<string, string> = {
  low: 'Thấp',
  medium: 'Trung bình',
  high: 'Cao',
  critical: 'Nghiêm trọng',
};

function formatVnd(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + ' ₫';
}

export function ClientHealthPanel({ token, clientId }: { token: string; clientId: string }) {
  const [view, setView] = useState<ChurnHealthClientView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchClientChurnHealth(token, clientId);
      setView(out.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải health score thất bại');
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [token, clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRescore() {
    setBusy(true);
    setError('');
    try {
      await postChurnScore(token, { client_id: clientId, force: true });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chấm điểm lại thất bại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="client-health-panel" data-testid="client-health-panel">
      <div className="client-health-panel__head">
        <h3>CS Health score</h3>
        <p className="muted client-health-panel__meta">
          Ticket volume · sentiment · trễ thanh toán · hết HĐ (RNOS-19)
        </p>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void handleRescore()}>
          {busy ? 'Đang chấm…' : 'Chấm lại'}
        </button>
      </div>

      {error ? <p className="client-health-panel__error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải health score…</p> : null}

      {!loading && !view ? (
        <p className="muted">
          Chưa có điểm health — bấm <strong>Chấm lại</strong> hoặc chờ job nightly.
        </p>
      ) : null}

      {view ? (
        <article className="client-health-card card">
          <header className="client-health-card__head">
            <div>
              <strong>{view.health.health_score}</strong>
              <span className="muted"> / 100</span>
            </div>
            <div className="client-health-card__badges">
              <span className={`health-band health-band--${view.health.health_band}`}>
                {BAND_LABELS[view.health.health_band] ?? view.health.health_band}
              </span>
              <span className={`risk-badge risk-badge--${view.health.risk_level}`}>
                Churn risk {view.health.churn_risk_pct}% · {RISK_LABELS[view.health.risk_level]}
              </span>
              {view.health.ticket_spike ? <span className="health-flag health-flag--spike">Ticket spike</span> : null}
            </div>
          </header>

          <p className="muted client-health-card__updated">
            Cập nhật: {new Date(view.calculated_at).toLocaleString('vi-VN')}
          </p>

          <div className="client-health-card__signals">
            <span>Ticket mở: {view.health.signals.tickets_open}</span>
            <span>7 ngày: {view.health.signals.tickets_last_7d}</span>
            <span>Trước 7 ngày: {view.health.signals.tickets_prev_7d}</span>
            <span>Phản ánh mở: {view.health.signals.negative_tickets_open}</span>
            <span>Quá hạn TT: {formatVnd(view.health.signals.payment_overdue_vnd)}</span>
            {view.health.signals.contract_days_until_end != null ? (
              <span>HĐ còn {view.health.signals.contract_days_until_end} ngày</span>
            ) : null}
          </div>

          {view.health.factors.length ? (
            <ul className="client-health-card__factors">
              {view.health.factors.map((factor) => (
                <li key={factor.key} className={`factor-chip factor-chip--${factor.sign === '+' ? 'plus' : 'minus'}`}>
                  {factor.label}
                </li>
              ))}
            </ul>
          ) : null}

          {view.health.renewal_recommended ? (
            <p className="client-health-card__renewal">
              <Link href={`/agency/clients/${clientId}?tab=retain`} className="btn btn-primary">
                Mở Renewal flow (Retain)
              </Link>
            </p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
