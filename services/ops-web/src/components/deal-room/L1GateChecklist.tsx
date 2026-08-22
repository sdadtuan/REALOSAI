'use client';

export interface L1GateChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

interface Props {
  items: L1GateChecklistItem[];
  title?: string;
}

export function L1GateChecklist({ items, title = 'Checklist G4 — L1 R5' }: Props) {
  if (!items.length) return null;

  return (
    <div className="deal-room-l1-checklist" role="list" aria-label={title}>
      <p className="deal-room-l1-checklist__title">{title}</p>
      <ul className="deal-room-checklist deal-room-checklist--block">
        {items.map((item) => (
          <li
            key={item.key}
            className={item.done ? 'deal-room-checklist__item--ok' : undefined}
            role="listitem"
          >
            <span aria-hidden>{item.done ? '☑' : '☐'}</span> {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
