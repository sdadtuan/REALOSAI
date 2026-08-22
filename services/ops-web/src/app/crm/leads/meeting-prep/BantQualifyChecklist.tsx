'use client';

import { useEffect, useState } from 'react';
import { BANT_KEYS } from '@/lib/crm/intake-bant';

const BANT_LABELS: Record<(typeof BANT_KEYS)[number], string> = {
  budget: 'Budget — ngân sách rõ',
  authority: 'Authority — người quyết định',
  need: 'Need — pain đủ sâu',
  timeline: 'Timeline — mốc triển khai',
  fit: 'Fit — phù hợp DV PTT',
  history: 'History — đã thử gì',
};

type Props = {
  leadId: number;
  compact?: boolean;
};

function storageKey(leadId: number): string {
  return `lmp-m2-bant-check:${leadId}`;
}

export function BantQualifyChecklist({ leadId, compact }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(leadId));
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      setChecked({});
    }
  }, [leadId]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(storageKey(leadId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const done = BANT_KEYS.filter((k) => checked[k]).length;

  return (
    <div className={`lmp-bant-checklist${compact ? ' lmp-bant-checklist--compact' : ''}`}>
      <p className="lmp-bant-checklist__head">
        BANT qualify trước Intake Go · {done}/{BANT_KEYS.length}
      </p>
      <ul className="lmp-bant-checklist__list">
        {BANT_KEYS.map((key) => (
          <li key={key}>
            <label>
              <input type="checkbox" checked={Boolean(checked[key])} onChange={() => toggle(key)} />
              <span>{BANT_LABELS[key]}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
