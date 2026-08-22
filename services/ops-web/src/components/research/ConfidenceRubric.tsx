'use client';

import {
  CONFIDENCE_BAND_LABELS,
  type ConfidenceBand,
  type ConfidenceRubric as ConfidenceRubricValue,
  type RubricDim,
} from '@/lib/market-research-api';

const DIMS: Array<{ id: RubricDim; label: string }> = [
  { id: 'S', label: 'Chất lượng nguồn' },
  { id: 'F', label: 'Phù hợp & coverage' },
  { id: 'T', label: 'Tam giác nguồn' },
  { id: 'A', label: 'Độ vững phân tích' },
  { id: 'R', label: 'Độ mới' },
];

export const EMPTY_RUBRIC: ConfidenceRubricValue = {
  S: 0,
  F: 0,
  T: 0,
  A: 0,
  R: 0,
  statistical_inference: false,
};

export function ConfidenceRubric({
  value,
  band,
  disabled,
  onChange,
}: {
  value: ConfidenceRubricValue;
  band?: ConfidenceBand | null;
  disabled?: boolean;
  onChange: (next: ConfidenceRubricValue) => void;
}) {
  function setDim(id: RubricDim, n: number) {
    onChange({ ...value, [id]: n });
  }

  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.6rem' }}>
      <legend>Rubric độ tin cậy</legend>
      <p className="muted" style={{ margin: '0 0 0.5rem', fontSize: '0.85rem' }}>
        Không ghi 95% confidence trừ khi đây là inference thống kê.
      </p>
      {DIMS.map((dim) => (
        <label key={dim.id} style={{ display: 'grid', gap: 4, marginBottom: '0.45rem' }}>
          <span>
            {dim.label} <strong>{value[dim.id]}</strong>
          </span>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={value[dim.id]}
            disabled={disabled}
            onChange={(e) => setDim(dim.id, Number(e.target.value))}
            aria-label={dim.label}
          />
        </label>
      ))}
      <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={Boolean(value.statistical_inference)}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, statistical_inference: e.target.checked })}
        />
        Suy luận thống kê
      </label>
      {band ? (
        <p style={{ margin: '0.5rem 0 0' }}>
          Band: <strong>{CONFIDENCE_BAND_LABELS[band]}</strong>
        </p>
      ) : null}
    </fieldset>
  );
}
