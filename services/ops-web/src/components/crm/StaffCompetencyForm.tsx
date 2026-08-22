'use client';

type CompetencyMetric = {
  id?: string;
  label?: string;
  weight?: number;
};

type CompetencyClassification = {
  id?: string;
  min_score?: number;
  max_score?: number;
  level_id?: string;
  label?: string;
};

type CompetencyConfig = {
  metrics?: CompetencyMetric[];
  classifications?: CompetencyClassification[];
};

type Props = {
  config: CompetencyConfig;
  readOnly?: boolean;
  onChange: (next: CompetencyConfig) => void;
};

export function StaffCompetencyForm({ config, readOnly, onChange }: Props) {
  const metrics = config.metrics ?? [];
  const classifications = config.classifications ?? [];

  function updateMetric(index: number, patch: Partial<CompetencyMetric>) {
    onChange({
      ...config,
      metrics: metrics.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    });
  }

  function updateClass(index: number, patch: Partial<CompetencyClassification>) {
    onChange({
      ...config,
      classifications: classifications.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    });
  }

  return (
    <div className="staff-levels-form__grid">
      <section>
        <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Metrics</h3>
        {metrics.map((m, index) => (
          <div key={m.id ?? index} className="staff-levels-form__row">
            <label>
              ID
              <input value={m.id ?? ''} readOnly />
            </label>
            <label>
              Nhãn
              <input
                value={m.label ?? ''}
                readOnly={readOnly}
                onChange={(e) => updateMetric(index, { label: e.target.value })}
              />
            </label>
            <label>
              Trọng số %
              <input
                type="number"
                value={m.weight ?? 0}
                readOnly={readOnly}
                onChange={(e) => updateMetric(index, { weight: Number(e.target.value) })}
              />
            </label>
          </div>
        ))}
      </section>
      <section>
        <h3 style={{ marginTop: 0, fontSize: '0.95rem' }}>Phân loại level</h3>
        {classifications.map((c, index) => (
          <div key={c.id ?? index} className="staff-levels-form__row">
            <label>
              Nhãn
              <input
                value={c.label ?? ''}
                readOnly={readOnly}
                onChange={(e) => updateClass(index, { label: e.target.value })}
              />
            </label>
            <label>
              Min
              <input
                type="number"
                value={c.min_score ?? 0}
                readOnly={readOnly}
                onChange={(e) => updateClass(index, { min_score: Number(e.target.value) })}
              />
            </label>
            <label>
              Max
              <input
                type="number"
                value={c.max_score ?? 0}
                readOnly={readOnly}
                onChange={(e) => updateClass(index, { max_score: Number(e.target.value) })}
              />
            </label>
            <label>
              Level id
              <input
                value={c.level_id ?? ''}
                readOnly={readOnly}
                onChange={(e) => updateClass(index, { level_id: e.target.value })}
              />
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}
