export interface IntakeQuestionItem {
  key: string;
  text: string;
  critical?: boolean;
}

export interface IntakeRedFlagItem {
  key: string;
  text: string;
}

export interface IntakeDefinitionUi {
  slug: string;
  title: string;
  phone_questions: string[];
  inperson_questions: string[];
  phone_question_items?: IntakeQuestionItem[];
  inperson_question_items?: IntakeQuestionItem[];
  red_flag_items?: IntakeRedFlagItem[];
  red_flags?: string[];
  schema_version?: number;
}

export type IntakeSessionMode = 'phone' | 'in_person';

export type DiscoveryConfidence = 'confirmed' | 'partial' | 'unknown' | '';

export interface DiscoveryResponseEntry {
  asked: boolean;
  answer: string;
  confidence: DiscoveryConfidence;
}

export function normalizeIntakeMode(mode: string | null | undefined): IntakeSessionMode {
  return mode === 'in_person' ? 'in_person' : 'phone';
}

export function questionItemsForMode(
  definition: IntakeDefinitionUi | null,
  mode: IntakeSessionMode,
): IntakeQuestionItem[] {
  if (!definition) return [];
  const structured =
    mode === 'in_person'
      ? definition.inperson_question_items
      : definition.phone_question_items;
  if (structured?.length) return structured;
  const texts =
    mode === 'in_person' ? definition.inperson_questions : definition.phone_questions;
  return (texts ?? []).map((text, index) => ({
    key: String(index),
    text,
    critical: false,
  }));
}

export function questionsForMode(
  definition: IntakeDefinitionUi | null,
  mode: IntakeSessionMode,
): string[] {
  return questionItemsForMode(definition, mode).map((q) => q.text);
}

export function legacyIndexKey(index: number): string {
  return String(index);
}

export function resolveQuestionKey(
  items: IntakeQuestionItem[],
  index: number,
): string {
  return items[index]?.key ?? legacyIndexKey(index);
}
