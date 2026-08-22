'use client';

import { useMemo } from 'react';
import {
  mergePresalesFormData,
  parsePresalesFormFields,
  validatePresalesConsultTaskDoneClient,
} from '@/lib/crm/presales-task-form';

export interface PresalesTaskFormItem {
  id: number;
  stage?: string;
  title: string;
  description?: string;
  is_done: boolean;
  form_fields?: unknown;
  form_data?: Record<string, unknown>;
  ai_prompt_key?: string;
  ai_output?: string;
}

interface Props {
  task: PresalesTaskFormItem;
  stage?: string;
  draft: Record<string, unknown>;
  disabled: boolean;
  onDraftChange: (taskId: number, key: string, value: string) => void;
  onToggleDone: (taskId: number, nextDone: boolean, formData: Record<string, unknown>) => void;
  onSaveForm: (taskId: number, formData: Record<string, unknown>) => void;
  onValidationError?: (message: string) => void;
  showAiAssist?: boolean;
  aiBusy?: boolean;
  onAiAssist?: (taskId: number, formData: Record<string, unknown>) => void;
}

export function PresalesTaskFormCard({
  task,
  stage,
  draft,
  disabled,
  onDraftChange,
  onToggleDone,
  onSaveForm,
  onValidationError,
  showAiAssist = false,
  aiBusy = false,
  onAiAssist,
}: Props) {
  const fields = useMemo(() => parsePresalesFormFields(task.form_fields), [task.form_fields]);
  const mergedFormData = useMemo(
    () => mergePresalesFormData(task.form_data, draft),
    [task.form_data, draft],
  );

  function fieldValue(key: string): string {
    const raw = draft[key] ?? task.form_data?.[key];
    if (raw === null || raw === undefined) return '';
    return String(raw);
  }

  function handleToggle(nextDone: boolean) {
    if (nextDone) {
      const err = validatePresalesConsultTaskDoneClient({
        stage: stage ?? task.stage,
        aiPromptKey: task.ai_prompt_key,
        aiOutput: task.ai_output,
        formFields: task.form_fields,
        formData: mergedFormData,
      });
      if (err) {
        onValidationError?.(err);
        return;
      }
    }
    onToggleDone(task.id, nextDone, mergedFormData);
  }

  return (
    <div
      className="presales-task-card"
      style={{
        border: '1px solid var(--border, #cbd5e1)',
        borderRadius: 8,
        padding: '0.65rem 0.75rem',
        marginBottom: '0.65rem',
        background: task.is_done ? '#f0fdf4' : '#fff',
      }}
    >
      <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontWeight: 600 }}>
        <input
          type="checkbox"
          checked={task.is_done}
          disabled={disabled}
          onChange={(e) => handleToggle(e.target.checked)}
          style={{ marginTop: '0.2rem' }}
        />
        <span>{task.title}</span>
      </label>
      {task.description ? (
        <p className="muted" style={{ margin: '0.35rem 0 0.5rem 1.35rem', fontSize: '0.85rem' }}>
          {task.description}
        </p>
      ) : null}
      {fields.length > 0 ? (
        <div
          className="presales-task-form"
          style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem', paddingLeft: '1.35rem' }}
        >
          {fields.map((field) => (
            <label key={field.key} style={{ display: 'grid', gap: '0.25rem' }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              {field.type === 'textarea' ? (
                <textarea
                  className="lead-input"
                  rows={3}
                  value={fieldValue(field.key)}
                  disabled={disabled || task.is_done}
                  onChange={(e) => onDraftChange(task.id, field.key, e.target.value)}
                  onBlur={(e) =>
                    onSaveForm(
                      task.id,
                      mergePresalesFormData(task.form_data, { ...draft, [field.key]: e.target.value }),
                    )
                  }
                />
              ) : (
                <input
                  className="lead-input"
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={fieldValue(field.key)}
                  disabled={disabled || task.is_done}
                  onChange={(e) => onDraftChange(task.id, field.key, e.target.value)}
                  onBlur={(e) =>
                    onSaveForm(
                      task.id,
                      mergePresalesFormData(task.form_data, { ...draft, [field.key]: e.target.value }),
                    )
                  }
                />
              )}
            </label>
          ))}
          {showAiAssist && onAiAssist ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                disabled={disabled || aiBusy || task.is_done}
                onClick={() => onAiAssist(task.id, mergedFormData)}
              >
                {aiBusy ? 'Đang phân tích…' : 'AI Hỗ trợ'}
              </button>
              {task.ai_output ? (
                <div
                  style={{
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap',
                    padding: '0.5rem',
                    border: '1px solid var(--border, #cbd5e1)',
                    borderRadius: 6,
                    background: '#f8fafc',
                  }}
                >
                  {task.ai_output}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
