'use client';

import { useState } from 'react';
import type { EntityCandidate } from './lead-meeting-prep.types';

type Props = {
  candidates: EntityCandidate[];
  busy?: boolean;
  onSelect: (entityId: string) => void | Promise<void>;
};

export function LeadMeetingPrepEntityPicker({ candidates, busy, onSelect }: Props) {
  const [selected, setSelected] = useState(candidates[0]?.id ?? '');

  return (
    <div className="lmp-entity-picker">
      <h3 className="lmp-panel__section-title">Chọn doanh nghiệp đúng</h3>
      <p className="muted" style={{ fontSize: '0.9rem' }}>
        Nhiều ứng viên trùng tên — chọn pháp nhân khớp lead trước khi phân tích tiếp.
      </p>
      <ul className="lmp-entity-list">
        {candidates.map((c) => (
          <li key={c.id}>
            <label className="lmp-entity-item">
              <input
                type="radio"
                name="lmp-entity"
                value={c.id}
                checked={selected === c.id}
                onChange={() => setSelected(c.id)}
              />
              <span>
                <strong>{c.label}</strong>
                <span className="muted" style={{ display: 'block', fontSize: '0.85rem' }}>
                  {c.url}
                  {c.phone ? ` · SĐT trang: ${c.phone}` : ''}
                  {c.confidence ? ` · ${c.confidence}` : ''}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={!selected || busy}
        onClick={() => void onSelect(selected)}
      >
        {busy ? 'Đang xử lý…' : 'Xác nhận & tiếp tục prep'}
      </button>
    </div>
  );
}
