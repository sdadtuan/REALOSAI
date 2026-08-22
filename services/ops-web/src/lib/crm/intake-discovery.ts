import {
  type DiscoveryConfidence,
  type DiscoveryResponseEntry,
  type IntakeQuestionItem,
  type IntakeSessionMode,
  legacyIndexKey,
  normalizeIntakeMode,
  questionItemsForMode,
  type IntakeDefinitionUi,
} from '@/lib/crm/intake-questions';

export type {
  DiscoveryConfidence,
  DiscoveryResponseEntry,
  IntakeDefinitionUi,
  IntakeQuestionItem,
  IntakeSessionMode,
} from '@/lib/crm/intake-questions';

export {
  normalizeIntakeMode,
  questionItemsForMode,
  questionsForMode,
  resolveQuestionKey,
} from '@/lib/crm/intake-questions';

export interface DiscoveryChecklistState {
  mode: IntakeSessionMode;
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  notes: string;
}

function emptyResponse(): DiscoveryResponseEntry {
  return { asked: false, answer: '', confidence: '' };
}

function parseConfidence(raw: unknown): DiscoveryConfidence {
  const val = String(raw ?? '').trim();
  if (val === 'confirmed' || val === 'partial' || val === 'unknown') return val;
  return '';
}

function parseResponseEntry(raw: unknown): DiscoveryResponseEntry {
  if (!raw || typeof raw !== 'object') return emptyResponse();
  const block = raw as Record<string, unknown>;
  return {
    asked: block.asked === true || block.asked === 'true' || block.asked === 1,
    answer: typeof block.answer === 'string' ? block.answer : '',
    confidence: parseConfidence(block.confidence),
  };
}

function migrateLegacyChecked(
  checkedRaw: Record<string, unknown>,
  items: IntakeQuestionItem[],
): Record<string, boolean> {
  const checked: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(checkedRaw)) {
    if (!(val === true || val === 'true' || val === 1)) continue;
    if (/^\d+$/.test(key) && items[Number(key)]) {
      checked[items[Number(key)].key] = true;
    } else {
      checked[key] = true;
    }
  }
  return checked;
}

function parseResponsesBlock(
  answers: Record<string, unknown> | undefined,
  checked: Record<string, boolean>,
): Record<string, DiscoveryResponseEntry> {
  const raw = answers?.discovery_responses;
  const responses: Record<string, DiscoveryResponseEntry> = {};
  if (raw && typeof raw === 'object') {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      responses[key] = parseResponseEntry(val);
    }
  }
  for (const [key, isChecked] of Object.entries(checked)) {
    if (!isChecked) continue;
    const prev = responses[key] ?? emptyResponse();
    responses[key] = { ...prev, asked: true };
  }
  return responses;
}

export function parseDiscoveryChecklist(
  answers: Record<string, unknown> | undefined,
  sessionMode: IntakeSessionMode,
  questionItems: IntakeQuestionItem[] = [],
): DiscoveryChecklistState {
  const raw = answers?.discovery_checklist;
  if (!raw || typeof raw !== 'object') {
    return { mode: sessionMode, checked: {}, responses: {}, notes: '' };
  }
  const block = raw as Record<string, unknown>;
  const notes = typeof block.notes === 'string' ? block.notes : '';
  const storedMode = normalizeIntakeMode(String(block.mode ?? sessionMode));
  const checkedRaw =
    block.checked && typeof block.checked === 'object'
      ? (block.checked as Record<string, unknown>)
      : {};
  const checked =
    storedMode === sessionMode
      ? migrateLegacyChecked(checkedRaw, questionItems)
      : {};
  const responses =
    storedMode === sessionMode ? parseResponsesBlock(answers, checked) : {};
  return { mode: sessionMode, checked, responses, notes };
}

export function countDiscoveryChecked(checked: Record<string, boolean>): number {
  return Object.values(checked).filter(Boolean).length;
}

export function countCriticalAnswered(
  items: IntakeQuestionItem[],
  checked: Record<string, boolean>,
  responses: Record<string, DiscoveryResponseEntry>,
): { answered: number; total: number } {
  const critical = items.filter((q) => q.critical);
  const total = critical.length;
  const answered = critical.filter((q) => {
    if (!checked[q.key]) return false;
    return Boolean(responses[q.key]?.answer?.trim());
  }).length;
  return { answered, total };
}

export function buildDiscoveryAnswersPatch(
  existing: Record<string, unknown> | undefined,
  crmNeed: string,
  discovery: DiscoveryChecklistState,
): Record<string, unknown> {
  const responses: Record<string, DiscoveryResponseEntry> = {};
  for (const [key, isChecked] of Object.entries(discovery.checked)) {
    if (!isChecked) continue;
    const prev = discovery.responses[key] ?? emptyResponse();
    responses[key] = {
      asked: true,
      answer: prev.answer.trim(),
      confidence: prev.confidence || '',
    };
  }
  return {
    ...(existing ?? {}),
    crm_fields: {
      ...(((existing?.crm_fields as Record<string, unknown>) ?? {}) as Record<string, unknown>),
      need: crmNeed,
    },
    discovery_checklist: {
      mode: discovery.mode,
      checked: discovery.checked,
      notes: discovery.notes.trim(),
    },
    discovery_responses: responses,
  };
}

export function emptyDiscoveryForMode(mode: IntakeSessionMode): DiscoveryChecklistState {
  return { mode, checked: {}, responses: {}, notes: '' };
}

export function toggleDiscoveryQuestion(
  prev: DiscoveryChecklistState,
  questionKey: string,
  next: boolean,
  mode: IntakeSessionMode,
): DiscoveryChecklistState {
  const checked = { ...prev.checked };
  const responses = { ...prev.responses };
  if (next) {
    checked[questionKey] = true;
    responses[questionKey] = {
      ...(responses[questionKey] ?? emptyResponse()),
      asked: true,
    };
  } else {
    delete checked[questionKey];
    delete responses[questionKey];
  }
  return { ...prev, mode, checked, responses };
}

export function updateDiscoveryResponse(
  prev: DiscoveryChecklistState,
  questionKey: string,
  patch: Partial<DiscoveryResponseEntry>,
  mode: IntakeSessionMode,
): DiscoveryChecklistState {
  const prevEntry = prev.responses[questionKey] ?? emptyResponse();
  const responses = {
    ...prev.responses,
    [questionKey]: {
      ...prevEntry,
      ...patch,
      asked: true,
    },
  };
  const checked = prev.checked[questionKey]
    ? prev.checked
    : { ...prev.checked, [questionKey]: true };
  return { ...prev, mode, checked, responses };
}

export function discoveryFromDefinition(
  definition: IntakeDefinitionUi | null,
  mode: IntakeSessionMode,
  answers?: Record<string, unknown>,
): DiscoveryChecklistState {
  const items = questionItemsForMode(definition, mode);
  return parseDiscoveryChecklist(answers, mode, items);
}
