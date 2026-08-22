'use client';

import type { ReadinessBreakdownFactor } from './lead-meeting-prep.types';

type Props = {
  score: number | null | undefined;
  breakdown?: ReadinessBreakdownFactor[];
};

export function CloseReadinessGauge({ score, breakdown = [] }: Props) {
  const s = score ?? 0;
  const tone = s < 40 ? 'red' : s < 70 ? 'yellow' : 'green';

  return (
    <div className={`lmp-gauge lmp-gauge--${tone}`} title="Close readiness">
      <div className="lmp-gauge__ring" aria-hidden>
        <span>{s}</span>
      </div>
      <div className="lmp-gauge__meta">
        <strong>Readiness {s}/100</strong>
        {breakdown.length ? (
          <ul className="lmp-gauge__breakdown">
            {breakdown.map((f) => (
              <li key={f.label_vi} className={f.applied ? 'is-on' : 'is-off'}>
                {f.label_vi} {f.applied ? `(+${f.points})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted">Chưa có breakdown</span>
        )}
      </div>
    </div>
  );
}
