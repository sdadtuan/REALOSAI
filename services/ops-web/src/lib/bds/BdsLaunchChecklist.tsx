'use client';

import type { LaunchChecklistItem } from './launch-copy';

type Props = {
  items: LaunchChecklistItem[];
};

export function BdsLaunchChecklist({ items }: Props) {
  return (
    <ul className="bds-launch-checklist" aria-label="Checklist trước mở ra quân">
      {items.map((item) => (
        <li
          key={item.id}
          className={`bds-launch-checklist__item${
            item.ok ? ' bds-launch-checklist__item--ok' : item.warn ? ' bds-launch-checklist__item--warn' : ' bds-launch-checklist__item--block'
          }`}
        >
          <span className="bds-launch-checklist__mark" aria-hidden="true">
            {item.ok ? '✓' : item.warn ? '!' : '✕'}
          </span>
          <div>
            <strong>{item.label}</strong>
            <p className="muted bds-launch-checklist__detail">{item.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
