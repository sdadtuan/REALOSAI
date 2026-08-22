'use client';

interface Props {
  staffName: string;
  staffCode?: string;
  strategy: string;
  reason: string;
  confidence?: number;
  loading?: boolean;
  onAccept?: () => void;
  onDismiss?: () => void;
}

const STRATEGY_LABELS: Record<string, string> = {
  project_pool: 'Pool dự án',
  source_match: 'Khớp nguồn',
  global_round_robin: 'Round-robin team',
};

export function RouteRepCard({
  staffName,
  staffCode,
  strategy,
  reason,
  confidence,
  loading,
  onAccept,
  onDismiss,
}: Props) {
  return (
    <section className="nba-card route-rep-card" aria-label="Lead routing recommendation" data-testid="route-rep-card">
      <div className="nba-card__header">
        <span className="nba-card__badge route-rep-card__badge">ROUTING</span>
        <h4 className="nba-card__title">{staffName}</h4>
      </div>
      <p className="muted route-rep-card__meta">
        {staffCode ? `${staffCode} · ` : ''}
        {STRATEGY_LABELS[strategy] ?? strategy}
      </p>
      <p className="nba-card__reason">{reason}</p>
      {confidence != null ? (
        <p className="muted nba-card__confidence">Độ tin cậy: {Math.round(confidence * 100)}%</p>
      ) : null}
      <p className="muted route-rep-card__hint">Chấp nhận sẽ gán owner lead — không auto-send khách (BR-AI-01).</p>
      <div className="nba-card__actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={loading} onClick={onAccept}>
          Chấp nhận & phân lead
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={onDismiss}>
          Bỏ
        </button>
      </div>
    </section>
  );
}
