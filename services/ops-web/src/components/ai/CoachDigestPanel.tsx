'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { CoachDigestRecord } from '@/lib/ai-api';
import { fetchCoachDigestCurrent, postCoachDigestGenerate } from '@/lib/ai-api';
import { formatPct } from '@/lib/kpi/format';

const SEVERITY_LABELS: Record<string, string> = {
  info: 'Ổn định',
  warning: 'Cần chú ý',
  critical: 'Ưu tiên cao',
};

export function CoachDigestPanel({ token }: { token: string }) {
  const [digest, setDigest] = useState<CoachDigestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const out = await fetchCoachDigestCurrent(token);
      setDigest(out.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải coach digest thất bại');
      setDigest(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate(force = false) {
    setGenerating(true);
    setError('');
    try {
      await postCoachDigestGenerate(token, { force });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generate digest thất bại');
    } finally {
      setGenerating(false);
    }
  }

  const snap = digest?.snapshot;

  return (
    <section className="coach-digest-panel" data-testid="coach-digest-panel">
      <div className="coach-digest-panel__head">
        <p className="muted">
          Manager Coach · RNOS-21 + RNOS-28 · Read-only aggregate (SLA, AI acceptance, pipeline, channel anomaly)
        </p>
        <button type="button" className="btn btn-secondary" disabled={generating} onClick={() => void handleGenerate(true)}>
          {generating ? 'Đang tạo…' : 'Tạo digest tuần'}
        </button>
      </div>

      {error ? <p className="coach-digest-panel__error">{error}</p> : null}
      {loading ? <p className="muted">Đang tải…</p> : null}

      {!loading && !snap ? (
        <p className="muted">
          Chưa có digest tuần này — bấm <strong>Tạo digest tuần</strong> hoặc chờ cron Thứ 2 08:00.
        </p>
      ) : null}

      {snap ? (
        <article className="coach-digest-card card">
          <header className="coach-digest-card__head">
            <div>
              <h3 style={{ margin: 0 }}>Tuần {snap.week_label}</h3>
              <p className="muted">{snap.narrative}</p>
            </div>
            <span className={`health-band health-band--${snap.severity === 'critical' ? 'critical' : snap.severity === 'warning' ? 'watch' : 'healthy'}`}>
              {SEVERITY_LABELS[snap.severity] ?? snap.severity}
            </span>
          </header>

          <div className="coach-digest-cards">
            {snap.cards.map((card) => (
              <div key={card.key} className="coach-digest-card-item" data-testid={`coach-card-${card.key}`}>
                <div className="coach-digest-card-item__head">
                  <strong>{card.title}</strong>
                  <span className={`health-band health-band--${card.severity === 'critical' ? 'critical' : card.severity === 'warning' ? 'watch' : 'healthy'}`}>
                    {SEVERITY_LABELS[card.severity]}
                  </span>
                </div>
                <p>{card.summary}</p>
                {card.key === 'ai_acceptance' && card.metrics.acceptance_rate_pct != null ? (
                  <p className="muted">Acceptance: {formatPct(Number(card.metrics.acceptance_rate_pct))}</p>
                ) : null}
                {card.key === 'ai_acceptance' && card.metrics.top_dismiss_reason ? (
                  <p className="muted">
                    Top dismiss: {String(card.metrics.top_dismiss_reason)} ({String(card.metrics.top_dismiss_count ?? 0)})
                  </p>
                ) : null}
                {card.key === 'channel_anomaly' ? (
                  <p className="muted">
                    Meta {String(card.metrics.meta_open ?? 0)} · Zalo {String(card.metrics.zalo_open ?? 0)} · CPL spike{' '}
                    {String(card.metrics.cpl_spike ?? 0)}
                  </p>
                ) : null}
                <Link href={card.drill_href} className="btn btn-link">
                  Drill-down →
                </Link>
              </div>
            ))}
          </div>

          {snap.email_preview ? (
            <details className="coach-digest-email-preview">
              <summary className="muted">Email preview (Mon 08:00)</summary>
              <pre className="coach-digest-email-preview__body">{snap.email_preview}</pre>
            </details>
          ) : null}

          {digest?.created_at ? (
            <p className="muted coach-digest-card__updated">
              Cập nhật: {new Date(digest.created_at).toLocaleString('vi-VN')}
            </p>
          ) : null}
        </article>
      ) : null}
    </section>
  );
}
