import type { LeadScoreSummary } from '@/lib/ai-api';

const BAND_LABELS: Record<string, string> = {
  hot: 'NÓNG',
  warm: 'ẤM',
  cold: 'LẠNH',
};

interface Props {
  score: LeadScoreSummary | null | undefined;
  pending?: boolean;
}

export function LeadScoreBadge({ score, pending }: Props) {
  if (pending) {
    return (
      <span className="lead-score-badge lead-score-badge--pending muted" aria-busy="true">
        …
      </span>
    );
  }

  if (!score) {
    return <span className="muted">—</span>;
  }

  const band = score.score_band ?? 'warm';
  const confidencePct = Math.round((score.confidence ?? 0) * 100);

  return (
    <span
      className={`lead-score-badge lead-score-badge--${band}`}
      title={`Độ tin cậy ${confidencePct}%`}
      aria-label={`Điểm ${Math.round(score.score_value)}, ${BAND_LABELS[band] ?? band}`}
    >
      <span className="lead-score-badge__value">{Math.round(score.score_value)}</span>
      <span className="lead-score-badge__band">{BAND_LABELS[band] ?? band.toUpperCase()}</span>
    </span>
  );
}
