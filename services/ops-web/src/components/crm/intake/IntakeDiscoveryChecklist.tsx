'use client';

import {
  countDiscoveryChecked,
  type DiscoveryConfidence,
  type DiscoveryResponseEntry,
  type IntakeQuestionItem,
  type IntakeSessionMode,
} from '@/lib/crm/intake-discovery';
import { intakeModeLabel } from '@/lib/crm/intake-labels';

const CONFIDENCE_OPTIONS: Array<{ value: DiscoveryConfidence; label: string }> = [
  { value: '', label: '— Độ chắc —' },
  { value: 'confirmed', label: 'Xác nhận "Confirmed"' },
  { value: 'partial', label: 'Một phần "Partial"' },
  { value: 'unknown', label: 'Chưa rõ "Unknown"' },
];

interface Props {
  questionItems: IntakeQuestionItem[];
  mode: IntakeSessionMode;
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  notes: string;
  disabled?: boolean;
  onToggle: (questionKey: string, next: boolean) => void;
  onResponseChange: (questionKey: string, patch: Partial<DiscoveryResponseEntry>) => void;
  onNotesChange: (value: string) => void;
}

export function IntakeDiscoveryChecklist({
  questionItems,
  mode,
  checked,
  responses,
  notes,
  disabled,
  onToggle,
  onResponseChange,
  onNotesChange,
}: Props) {
  const done = countDiscoveryChecked(checked);
  const total = questionItems.length;
  const minSuggested = mode === 'phone' ? 8 : 6;

  return (
    <div className="intake-discovery-checklist">
      <div className="intake-discovery-checklist__head">
        <strong>Câu hỏi gợi ý — {intakeModeLabel(mode)}</strong>
        <span className="muted intake-discovery-checklist__progress">
          Đã hỏi {done}/{total} câu
          {done < minSuggested ? ` · gợi ý ≥${minSuggested}` : ''}
        </span>
      </div>

      {questionItems.length === 0 ? (
        <p className="muted">Đang tải câu hỏi khảo sát…</p>
      ) : (
        <ul className="intake-discovery-checklist__items">
          {questionItems.map((item) => {
            const isChecked = Boolean(checked[item.key]);
            const response = responses[item.key];
            return (
              <li key={item.key} className="intake-discovery-checklist__row">
                <label className="intake-discovery-checklist__item">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(e) => onToggle(item.key, e.target.checked)}
                  />
                  <span>
                    {item.text}
                    {item.critical ? (
                      <span className="intake-discovery-checklist__critical"> · Quan trọng</span>
                    ) : null}
                  </span>
                </label>

                {isChecked ? (
                  <div className="intake-discovery-checklist__answer">
                    <textarea
                      className="kpi-input intake-discovery-checklist__answer-input"
                      rows={2}
                      value={response?.answer ?? ''}
                      disabled={disabled}
                      placeholder={
                        item.critical
                          ? 'Câu trả lời KH (bắt buộc gợi ý cho câu quan trọng)…'
                          : 'Câu trả lời KH (tuỳ chọn)…'
                      }
                      onChange={(e) => onResponseChange(item.key, { answer: e.target.value })}
                    />
                    <select
                      className="kpi-select intake-discovery-checklist__confidence"
                      value={response?.confidence ?? ''}
                      disabled={disabled}
                      aria-label={`Độ chắc câu ${item.key}`}
                      onChange={(e) =>
                        onResponseChange(item.key, {
                          confidence: e.target.value as DiscoveryConfidence,
                        })
                      }
                    >
                      {CONFIDENCE_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <label className="intake-field">
        <span className="muted">Ghi chú discovery</span>
        <textarea
          className="kpi-input intake-discovery-checklist__notes"
          rows={3}
          value={notes}
          disabled={disabled}
          placeholder="Insight thêm, objection, next step…"
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
    </div>
  );
}
