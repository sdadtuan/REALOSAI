'use client';

import { countRedFlagsChecked, type IntakeRedFlagsState } from '@/lib/crm/intake-red-flags';
import type { IntakeRedFlagItem } from '@/lib/crm/intake-questions';

interface Props {
  items: IntakeRedFlagItem[];
  state: IntakeRedFlagsState;
  disabled?: boolean;
  onToggle: (key: string, next: boolean) => void;
  onNotesChange: (value: string) => void;
}

export function IntakeRedFlagsSection({ items, state, disabled, onToggle, onNotesChange }: Props) {
  const count = countRedFlagsChecked(state.checked);

  return (
    <details className="intake-red-flags-section" open={count > 0}>
      <summary className="intake-red-flags-section__summary">
        <span>G. Red flags &quot;Red flags&quot;</span>
        <span
          className={
            count >= 2
              ? 'intake-red-flags-section__count intake-red-flags-section__count--warn'
              : 'muted'
          }
        >
          {count} flag{count >= 2 ? ' · gợi ý No-Go/Nurture' : ''}
        </span>
      </summary>

      <div className="intake-red-flags-section__body stack-gap">
        {items.length === 0 ? (
          <p className="muted">Đang tải red flags…</p>
        ) : (
          <ul className="intake-red-flags-section__list">
            {items.map((item) => (
              <li key={item.key}>
                <label className="intake-red-flags-section__item">
                  <input
                    type="checkbox"
                    checked={Boolean(state.checked[item.key])}
                    disabled={disabled}
                    onChange={(e) => onToggle(item.key, e.target.checked)}
                  />
                  <span>{item.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <label className="intake-field">
          <span className="muted">Ghi chú red flag</span>
          <textarea
            className="kpi-input"
            rows={2}
            value={state.notes}
            disabled={disabled}
            placeholder="Bối cảnh, cách xử lý, exception…"
            onChange={(e) => onNotesChange(e.target.value)}
          />
        </label>
      </div>
    </details>
  );
}
