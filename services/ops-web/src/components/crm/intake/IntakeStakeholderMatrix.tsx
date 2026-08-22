'use client';

import {
  STAKEHOLDER_INFLUENCE_OPTIONS,
  type IntakeStakeholderRow,
} from '@/lib/crm/intake-stakeholders';

interface Props {
  rows: IntakeStakeholderRow[];
  disabled?: boolean;
  onChange: (index: number, patch: Partial<IntakeStakeholderRow>) => void;
}

export function IntakeStakeholderMatrix({ rows, disabled, onChange }: Props) {
  return (
    <details className="intake-stakeholder-section" open>
      <summary className="intake-stakeholder-section__summary">
        <span>E. Ma trận stakeholder &quot;Stakeholder matrix&quot;</span>
        <span className="muted">Decision Maker · Influencer · Gatekeeper · User</span>
      </summary>

      <div className="intake-stakeholder-section__body">
        <div className="intake-stakeholder-table" role="table" aria-label="Ma trận stakeholder">
          <div className="intake-stakeholder-table__head" role="row">
            <span role="columnheader">Vai trò</span>
            <span role="columnheader">Họ tên</span>
            <span role="columnheader">Chức danh</span>
            <span role="columnheader">Ảnh hưởng</span>
            <span role="columnheader">Ghi chú</span>
          </div>
          {rows.map((row, index) => (
            <div key={row.role} className="intake-stakeholder-table__row" role="row">
              <span className="intake-stakeholder-table__role" role="cell">
                {row.role_label}
                {row.role === 'decision_maker' ? (
                  <span className="intake-discovery-checklist__critical"> *</span>
                ) : null}
              </span>
              <input
                className="kpi-input"
                role="cell"
                value={row.name}
                disabled={disabled}
                placeholder="Tên"
                onChange={(e) => onChange(index, { name: e.target.value })}
              />
              <input
                className="kpi-input"
                role="cell"
                value={row.title}
                disabled={disabled}
                placeholder="Chức danh"
                onChange={(e) => onChange(index, { title: e.target.value })}
              />
              <select
                className="kpi-select"
                role="cell"
                value={row.influence}
                disabled={disabled}
                onChange={(e) => onChange(index, { influence: e.target.value })}
              >
                {STAKEHOLDER_INFLUENCE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <input
                className="kpi-input"
                role="cell"
                value={row.notes}
                disabled={disabled}
                placeholder="Ghi chú"
                onChange={(e) => onChange(index, { notes: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
