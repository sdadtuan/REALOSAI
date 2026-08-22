'use client';

import type { AiScoreRecord } from '@/lib/ai-api';

interface Props {
  score?: AiScoreRecord | null;
  summary?: { score_value: number; score_band: string } | null;
}

export function DealScoreMiniBar({ score, summary }: Props) {
  const value = score?.score_value ?? summary?.score_value;
  if (value == null) return null;
  const band = score?.explainability_json?.score_band ?? summary?.score_band ?? 'warm';
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="deal-score-mini" aria-label={`Deal score ${pct}`} data-testid="deal-score-mini">
      <div className="deal-score-mini__track">
        <div className={`deal-score-mini__fill deal-score-mini__fill--${band}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="deal-score-mini__value">{pct}</span>
    </div>
  );
}
