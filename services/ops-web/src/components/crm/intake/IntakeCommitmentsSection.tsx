'use client';

import { countFilledCommitments, type IntakeCommitmentRow } from '@/lib/crm/intake-commitments';

interface Props {
  rows: IntakeCommitmentRow[];
  disabled?: boolean;
  onChange: (index: number, patch: Partial<IntakeCommitmentRow>) => void;
}

export function IntakeCommitmentsSection({ rows, disabled, onChange }: Props) {
  const filled = countFilledCommitments(rows);

  return (
    <details className="intake-commitments-section" open>
      <summary className="intake-commitments-section__summary">
        <span>F. Cam kết khách hàng &quot;Customer commitments&quot;</span>
        <span className="muted">
          {filled}/{rows.length} cam kết có nội dung
        </span>
      </summary>

      <div className="intake-commitments-section__body stack-gap">
        {rows.map((row, index) => (
          <div key={row.label} className="intake-commitment-row">
            <strong className="intake-commitment-row__label">{row.label}</strong>
            <label className="intake-field">
              <span className="muted">Nội dung cam kết</span>
              <textarea
                className="kpi-input"
                rows={2}
                value={row.detail}
                disabled={disabled}
                placeholder="KH cam kết cung cấp / tham gia / duyệt…"
                onChange={(e) => onChange(index, { detail: e.target.value })}
              />
            </label>
            <label className="intake-field">
              <span className="muted">Hạn / mốc</span>
              <input
                className="kpi-input"
                value={row.deadline}
                disabled={disabled}
                placeholder="VD: trước 15/08, sau họp board…"
                onChange={(e) => onChange(index, { deadline: e.target.value })}
              />
            </label>
          </div>
        ))}
      </div>
    </details>
  );
}
