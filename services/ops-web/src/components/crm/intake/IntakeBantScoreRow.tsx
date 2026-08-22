'use client';

import { BANT_FIELD_LABELS } from '@/lib/crm/intake-labels';
import type { BantKey } from '@/lib/crm/intake-bant';

interface Props {
  bantKey: BantKey;
  hint: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const SCORES = [1, 2, 3, 4, 5] as const;

export function IntakeBantScoreRow({ bantKey, hint, value, disabled, onChange }: Props) {
  const labels = BANT_FIELD_LABELS[bantKey];
  const unscored = value < 1 || value > 5;

  return (
    <div className={`intake-bant-score-row${unscored ? ' intake-bant-score-row--unscored' : ''}`}>
      <div className="intake-bant-score-row__head">
        <span className="intake-bant-score-row__label">{labels.label}</span>
        <small className="muted intake-bant-score-row__hint">{hint || labels.hint}</small>
      </div>

      <div className="intake-bant-score-row__radios" role="radiogroup" aria-label={labels.label}>
        {SCORES.map((score) => {
          const id = `intake-bant-${bantKey}-${score}`;
          return (
            <label key={score} className="intake-bant-score-row__radio" htmlFor={id}>
              <input
                id={id}
                type="radio"
                name={`intake-bant-${bantKey}`}
                value={score}
                checked={value === score}
                disabled={disabled}
                onChange={() => onChange(score)}
              />
              <span>{score}</span>
            </label>
          );
        })}
      </div>

      {unscored ? <p className="intake-bant-score-row__warn">Chưa chấm</p> : null}
    </div>
  );
}
