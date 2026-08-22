import { PRODUCT_TYPES } from './market-research.constants';
import type {
  CreateDecisionInput,
  CreateEvidenceInput,
  CreateProjectInput,
  CreateWaveInput,
} from './market-research.types';

export function validateCreateProject(input: CreateProjectInput): string[] {
  const messages: string[] = [];
  if (!String(input.client_id ?? '').trim()) {
    messages.push('client_id is required');
  }
  if (!PRODUCT_TYPES.includes(input.product_type as (typeof PRODUCT_TYPES)[number])) {
    messages.push('product_type is invalid');
  }
  if (String(input.decision_statement ?? '').trim().length < 20) {
    messages.push('decision_statement must be at least 20 characters');
  }
  if (String(input.title ?? '').trim().length < 8) {
    messages.push('title must be at least 8 characters');
  }
  const questions = Array.isArray(input.questions) ? input.questions : [];
  if (questions.length < 1) {
    messages.push('at least one question is required');
  }
  for (const q of questions) {
    if (!String(q?.question_vi ?? '').trim()) {
      messages.push('question_vi is required');
      break;
    }
  }
  return messages;
}

export function validateCreateEvidence(input: CreateEvidenceInput): string[] {
  const messages: string[] = [];
  if (!String(input.locator ?? '').trim()) {
    messages.push('locator is required');
  }
  const hasExcerpt = Boolean(String(input.excerpt ?? '').trim());
  const hasValueTriple =
    input.value_num != null &&
    Boolean(String(input.unit ?? '').trim()) &&
    Boolean(String(input.value_base ?? '').trim());
  if (!hasExcerpt && !hasValueTriple) {
    messages.push('excerpt or value+unit+base is required');
  }
  if (input.value_num != null) {
    if (!String(input.unit ?? '').trim()) messages.push('unit is required');
    if (!String(input.value_base ?? '').trim()) messages.push('value_base is required');
    if (!String(input.period_note ?? '').trim()) messages.push('period_note is required');
    if (!String(input.geography ?? '').trim()) messages.push('geography is required');
  }
  if (input.source_id == null && input.study_id == null) {
    messages.push('source_id or study_id is required');
  }
  return messages;
}

export function validateCreateWave(input: CreateWaveInput): string[] {
  const messages: string[] = [];
  const waveNo = Number(input?.wave_no);
  if (!Number.isInteger(waveNo) || waveNo < 1) {
    messages.push('wave_no must be >= 1');
  }
  if (!Array.isArray(input?.metric_json)) {
    messages.push('metric_json is required');
    return messages;
  }
  if (input.metric_json.length > 20) {
    messages.push('metric_json max 20 keys');
  }
  for (const row of input.metric_json) {
    const key = String(row?.key ?? '').trim();
    if (!key) {
      messages.push('metric key is required');
      break;
    }
    if (key.length > 40) {
      messages.push('metric key must be <= 40 chars');
      break;
    }
    if (row.value != null && typeof row.value !== 'number') {
      messages.push('metric value must be number or null');
      break;
    }
    if (row.value != null && !Number.isFinite(row.value)) {
      messages.push('metric value must be number or null');
      break;
    }
  }
  return messages;
}

export function validateCreateDecision(input: CreateDecisionInput): string[] {
  const messages: string[] = [];
  if (String(input?.decision_text ?? '').trim().length < 10) {
    messages.push('decision_text must be at least 10 characters');
  }
  if (!String(input?.owner_email ?? '').trim()) {
    messages.push('owner_email is required');
  }
  const insightId = Number(input?.insight_id);
  if (!Number.isInteger(insightId) || insightId < 1) {
    messages.push('insight_id is required');
  }
  return messages;
}

const THEME_CODE_RE = /^[A-Z][A-Z0-9_]{1,31}$/;

export function validateThemeCode(code: string): 'taxonomy_code_invalid' | undefined {
  if (!THEME_CODE_RE.test(String(code ?? '').trim())) {
    return 'taxonomy_code_invalid';
  }
  return undefined;
}
