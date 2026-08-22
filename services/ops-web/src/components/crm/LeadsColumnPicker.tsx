'use client';

import { useEffect, useRef, useState } from 'react';
import {
  LEADS_COLUMN_DEFS,
  type LeadsColumnId,
  writeLeadsVisibleColumns,
} from '@/lib/crm/leads-columns';

type Props = {
  visible: Set<LeadsColumnId>;
  showScores: boolean;
  showLeadKindTags: boolean;
  onChange: (next: Set<LeadsColumnId>) => void;
};

export function LeadsColumnPicker({ visible, showScores, showLeadKindTags, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  function toggleColumn(id: LeadsColumnId) {
    const next = new Set(visible);
    if (next.has(id)) {
      if (next.size <= 2) return;
      next.delete(id);
    } else {
      next.add(id);
    }
    writeLeadsVisibleColumns(next);
    onChange(next);
  }

  const columns = LEADS_COLUMN_DEFS.filter((col) => {
    if (col.scoreOnly && !showScores) return false;
    if (col.id === 'kind' && !showLeadKindTags) return false;
    return true;
  });

  return (
    <div className="leads-column-picker" ref={rootRef}>
      <button
        type="button"
        className="btn btn-sm btn-secondary leads-column-picker__trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
        title="Chọn cột hiển thị"
      >
        ⚙ Cột
      </button>
      {open ? (
        <div className="leads-column-picker__popover" role="dialog" aria-label="Chọn cột bảng lead">
          <p className="leads-column-picker__title">Cột hiển thị</p>
          <ul className="leads-column-picker__list">
            {columns.map((col) => (
              <li key={col.id}>
                <label className="leads-column-picker__item">
                  <input
                    type="checkbox"
                    checked={visible.has(col.id)}
                    onChange={() => toggleColumn(col.id)}
                  />
                  {col.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
