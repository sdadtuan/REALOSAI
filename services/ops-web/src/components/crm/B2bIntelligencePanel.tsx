'use client';

import { useEffect, useState } from 'react';
import {
  fetchB2bLeadIntelligence,
  type B2bLeadIntelligence,
} from '@/lib/b2b-intelligence-api';
import { ApiError } from '@/lib/api';

const BAND_LABELS: Record<string, string> = {
  hot: 'NÓNG',
  warm: 'ẤM',
  cold: 'LẠNH',
};

function formatDue(seconds: number): string {
  if (seconds <= 0) return 'Ngay';
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)} giờ`;
  return `${Math.ceil(seconds / 86400)} ngày`;
}

interface Props {
  token: string;
  leadId: number;
}

export function B2bIntelligencePanel({ token, leadId }: Props) {
  const [data, setData] = useState<B2bLeadIntelligence | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchB2bLeadIntelligence(token, leadId)
      .then((out) => {
        if (!cancelled) setData(out);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Không tải được intelligence B2B.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, leadId]);

  if (loading) {
    return (
      <section className="b2b-intelligence-panel" aria-busy="true">
        <p className="muted">Đang tải điểm AI &amp; hành động gợi ý…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="b2b-intelligence-panel">
        <p className="error">{error}</p>
      </section>
    );
  }

  if (!data) return null;

  const { score, nba } = data;
  const showWhyHot = score.band === 'hot' && score.reasons.length > 0;

  return (
    <section className="b2b-intelligence-panel" aria-label="B2B intelligence">
      <div className="b2b-intelligence-grid">
        <div className="b2b-score-card">
          <div className="b2b-score-card__header">
            <h3>Điểm AI</h3>
            <span className={`ai-score-gauge__band ai-score-gauge__band--${score.band}`}>
              {BAND_LABELS[score.band] ?? score.band}
            </span>
          </div>
          <p className="b2b-score-card__value">
            {score.score != null ? Math.round(score.score) : '—'}
            <span className="muted"> / 100</span>
          </p>
          {showWhyHot ? (
            <div className="b2b-why-hot">
              <h4>Vì sao Hot</h4>
              <ul className="b2b-why-hot__list">
                {score.reasons.map((reason) => (
                  <li key={`${reason.feature}-${reason.weight}`}>
                    <span
                      className={
                        reason.direction === '+'
                          ? 'b2b-why-hot__chip b2b-why-hot__chip--plus'
                          : 'b2b-why-hot__chip b2b-why-hot__chip--minus'
                      }
                    >
                      {reason.direction === '+' ? '+' : '−'}
                      {reason.weight}
                    </span>
                    {reason.feature}
                  </li>
                ))}
              </ul>
            </div>
          ) : score.reasons.length > 0 ? (
            <ul className="b2b-why-hot__list">
              {score.reasons.slice(0, 3).map((reason) => (
                <li key={`${reason.feature}-${reason.weight}`}>
                  <span className="muted">{reason.direction}</span> {reason.feature}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Chưa có explainability — score sẽ cập nhật sau ingest.</p>
          )}
        </div>

        {nba ? (
          <div className="b2b-nba-card">
            <h3>Hành động tiếp theo</h3>
            <p className="b2b-nba-card__action">{nba.label_vi}</p>
            <p className="muted b2b-nba-card__due">Hạn: {formatDue(nba.due_in_seconds)}</p>
            {nba.action === 'call' ? (
              <a href="#lead-contact-actions" className="btn btn-sm btn-primary">
                Gọi ngay
              </a>
            ) : nba.action === 'note' ? (
              <a href="#lead-activity-form" className="btn btn-sm btn-secondary">
                Ghi chú
              </a>
            ) : (
              <a href="#lead-activity-form" className="btn btn-sm btn-secondary">
                Đặt hẹn
              </a>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
