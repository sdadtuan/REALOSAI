'use client';

import { useCallback, useEffect, useState } from 'react';

const STEPS = [
  { id: 'open', minutes: '0–5', label: 'Mở Deal Room + screen-share', hint: 'Opening narrative' },
  { id: 'recap', minutes: '5–15', label: 'Recap pain + urgency', hint: 'Slide bullets + ROI' },
  { id: 'l1', minutes: '15–30', label: 'Trình bày L1 R5 (Solution)', hint: 'SCI intro bridge' },
  { id: 'offer', minutes: '30–40', label: 'Trình bày 3 gói CB/TC/CS', hint: 'Offer ladder · anchor TC' },
  { id: 'close', minutes: '40–45', label: 'Close ask + objection', hint: 'Objection sidebar' },
] as const;

type Props = {
  leadId: number;
};

function storageKey(leadId: number) {
  return `deal-room-sop-check:${leadId}`;
}

export function DealRoomScreenShareChecklist({ leadId }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(leadId));
      if (raw) setDone(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      setDone({});
    }
  }, [leadId]);

  const toggle = useCallback(
    (id: string) => {
      setDone((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        try {
          localStorage.setItem(storageKey(leadId), JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [leadId],
  );

  const completed = STEPS.filter((s) => done[s.id]).length;

  return (
    <section className="deal-room-sop-checklist" aria-label="SOP buổi chốt 45 phút">
      <header className="deal-room-sop-checklist__head">
        <h3>SOP screen-share 45 phút</h3>
        <span className="muted">
          {completed}/{STEPS.length} bước
        </span>
      </header>
      <ol className="deal-room-sop-checklist__list">
        {STEPS.map((step) => (
          <li key={step.id} className={done[step.id] ? 'is-done' : ''}>
            <label>
              <input type="checkbox" checked={Boolean(done[step.id])} onChange={() => toggle(step.id)} />
              <span className="deal-room-sop-checklist__time">{step.minutes}</span>
              <span className="deal-room-sop-checklist__label">{step.label}</span>
              <span className="muted deal-room-sop-checklist__hint">{step.hint}</span>
            </label>
          </li>
        ))}
      </ol>
    </section>
  );
}
