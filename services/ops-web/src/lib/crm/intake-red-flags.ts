import type { IntakeRedFlagItem } from '@/lib/crm/intake-questions';

export interface IntakeRedFlagsState {
  checked: Record<string, boolean>;
  notes: string;
}

export function redFlagItemsFromDefinition(
  texts: string[] | undefined,
  structured: IntakeRedFlagItem[] | undefined,
): IntakeRedFlagItem[] {
  if (structured?.length) return structured;
  return (texts ?? []).map((text, index) => ({
    key: `rf_${String(index).padStart(2, '0')}`,
    text,
  }));
}

export function parseRedFlags(answers: Record<string, unknown> | undefined): IntakeRedFlagsState {
  const raw = answers?.red_flags;
  if (!raw || typeof raw !== 'object') {
    return { checked: {}, notes: '' };
  }
  const block = raw as Record<string, unknown>;
  const notes = typeof block.notes === 'string' ? block.notes : '';
  const checkedRaw = block.checked;
  const checked: Record<string, boolean> = {};
  if (checkedRaw && typeof checkedRaw === 'object') {
    for (const [key, val] of Object.entries(checkedRaw as Record<string, unknown>)) {
      if (val === true || val === 'true' || val === 1) checked[key] = true;
    }
  }
  return { checked, notes };
}

export function countRedFlagsChecked(checked: Record<string, boolean>): number {
  return Object.values(checked).filter(Boolean).length;
}

export function buildRedFlagsPatch(
  existing: Record<string, unknown> | undefined,
  state: IntakeRedFlagsState,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    red_flags: {
      checked: state.checked,
      notes: state.notes.trim(),
    },
  };
}

export function emptyRedFlags(): IntakeRedFlagsState {
  return { checked: {}, notes: '' };
}

export function toggleRedFlag(
  prev: IntakeRedFlagsState,
  key: string,
  next: boolean,
): IntakeRedFlagsState {
  const checked = { ...prev.checked };
  if (next) checked[key] = true;
  else delete checked[key];
  return { ...prev, checked };
}
