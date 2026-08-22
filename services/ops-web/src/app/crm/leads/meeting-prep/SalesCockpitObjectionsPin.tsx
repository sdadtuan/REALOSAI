'use client';

import { useState } from 'react';
import type { CloseIntelligence } from './lead-meeting-prep.types';

type Props = {
  sci: CloseIntelligence;
};

export function SalesCockpitObjectionsPin({ sci }: Props) {
  const [expanded, setExpanded] = useState(false);
  const objections = sci.objection_playbook;
  if (!objections.length) return null;

  const visible = expanded ? objections : objections.slice(0, 3);

  return (
    <aside className="lmp-objections-pin" aria-label="Objection playbook — luôn hiện khi gọi chốt">
      <header className="lmp-objections-pin__head">
        <strong>Objections</strong>
        <span className="muted">{objections.length} kịch bản</span>
        <button
          type="button"
          className="btn btn-sm btn-secondary lmp-objections-pin__toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? 'Thu gọn' : 'Mở rộng'}
        </button>
      </header>
      <ul className="lmp-objections-pin__list">
        {visible.map((o) => (
          <li key={o.objection_vi} className="lmp-objections-pin__item">
            <details open={expanded}>
              <summary>{o.objection_vi}</summary>
              <p>{o.rebuttal_vi}</p>
            </details>
          </li>
        ))}
      </ul>
      {!expanded && objections.length > 3 ? (
        <p className="muted lmp-objections-pin__more">+{objections.length - 3} objection khác</p>
      ) : null}
    </aside>
  );
}
