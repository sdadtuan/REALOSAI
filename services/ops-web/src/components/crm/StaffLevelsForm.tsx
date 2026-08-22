'use client';

type StaffLevel = {
  id?: string;
  code?: string;
  label?: string;
  emoji?: string;
  experience?: string;
  max_leads_min?: number;
  max_leads_max?: number;
  enabled?: boolean;
  sort_order?: number;
};

type Props = {
  levels: StaffLevel[];
  readOnly?: boolean;
  onChange: (next: StaffLevel[]) => void;
};

export function StaffLevelsForm({ levels, readOnly, onChange }: Props) {
  function update(index: number, patch: Partial<StaffLevel>) {
    onChange(levels.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="staff-levels-form__grid">
      {levels.map((row, index) => (
        <div key={row.id ?? row.code ?? index} className="staff-levels-form__row">
          <label>
            Mã
            <input
              value={row.code ?? ''}
              readOnly={readOnly}
              onChange={(e) => update(index, { code: e.target.value })}
            />
          </label>
          <label>
            Nhãn
            <input
              value={row.label ?? ''}
              readOnly={readOnly}
              onChange={(e) => update(index, { label: e.target.value })}
            />
          </label>
          <label>
            Kinh nghiệm
            <input
              value={row.experience ?? ''}
              readOnly={readOnly}
              onChange={(e) => update(index, { experience: e.target.value })}
            />
          </label>
          <label>
            Lead min
            <input
              type="number"
              value={row.max_leads_min ?? 0}
              readOnly={readOnly}
              onChange={(e) => update(index, { max_leads_min: Number(e.target.value) })}
            />
          </label>
          <label>
            Lead max
            <input
              type="number"
              value={row.max_leads_max ?? 0}
              readOnly={readOnly}
              onChange={(e) => update(index, { max_leads_max: Number(e.target.value) })}
            />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.35rem' }}>
            <input
              type="checkbox"
              checked={row.enabled !== false}
              disabled={readOnly}
              onChange={(e) => update(index, { enabled: e.target.checked })}
            />
            Bật
          </label>
        </div>
      ))}
    </div>
  );
}
