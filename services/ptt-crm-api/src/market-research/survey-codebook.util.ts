import { piiHint } from './evidence-immutable.util';
import type { CodebookEvidenceDraft, CjChoice, VwRespondent } from './market-research.types';
import { CJ_MAX_ATTRIBUTES, CJ_MIN_ATTRIBUTES } from './market-research.types';

const CODEBOOK_COLUMNS = [
  'respondent_id',
  'question_code',
  'value',
  'unit',
  'value_base',
  'period_note',
  'geography',
] as const;

const VW_COLUMNS = [
  'respondent_id',
  'too_cheap',
  'cheap',
  'expensive',
  'too_expensive',
] as const;

const MAX_DATA_ROWS = 500;

function coded(code: string): never {
  throw Object.assign(new Error(code), { code });
}

export function parseCsv(text: string): string[][] {
  const raw = String(text ?? '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.includes('"')) coded('codebook_csv_invalid');
    rows.push(line.split(',').map((cell) => cell.trim()));
  }
  return rows;
}

function headerMatches(actual: string[], expected: readonly string[]): boolean {
  if (actual.length !== expected.length) return false;
  return expected.every((col, i) => actual[i].toLowerCase() === col);
}

function recordsFromRows(
  rows: string[][],
  columns: readonly string[],
): Array<Record<string, string>> {
  if (!rows.length) coded('codebook_csv_invalid');
  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, ''));
  if (!headerMatches(header, columns)) coded('codebook_csv_invalid');
  const data = rows.slice(1);
  if (data.length > MAX_DATA_ROWS) coded('codebook_row_cap');
  return data.map((cells) => {
    if (cells.length !== columns.length) coded('codebook_csv_invalid');
    const rec: Record<string, string> = {};
    for (let i = 0; i < columns.length; i += 1) {
      rec[columns[i]] = cells[i] ?? '';
    }
    return rec;
  });
}

export function assertCodebookNoPii(rows: Array<Record<string, string>>): void {
  for (const row of rows) {
    for (const cell of Object.values(row)) {
      if (piiHint(String(cell ?? ''))) coded('survey_pii_forbidden');
    }
  }
}

export function parseCodebookCsv(text: string): CodebookEvidenceDraft[] {
  const records = recordsFromRows(parseCsv(text), CODEBOOK_COLUMNS);
  assertCodebookNoPii(records);
  const drafts: CodebookEvidenceDraft[] = [];
  for (const rec of records) {
    const value_num = Number(rec.value);
    if (!Number.isFinite(value_num)) continue;
    drafts.push({
      locator: `Q-${rec.question_code}`,
      value_num,
      unit: rec.unit,
      value_base: rec.value_base,
      period_note: rec.period_note,
      geography: rec.geography,
      respondent_id: rec.respondent_id,
    });
  }
  return drafts;
}

export function parseVwCsv(text: string): Array<{ respondent_id: string } & VwRespondent> {
  const records = recordsFromRows(parseCsv(text), VW_COLUMNS);
  assertCodebookNoPii(records);
  const rows: Array<{ respondent_id: string } & VwRespondent> = [];
  for (const rec of records) {
    const too_cheap = Number(rec.too_cheap);
    const cheap = Number(rec.cheap);
    const expensive = Number(rec.expensive);
    const too_expensive = Number(rec.too_expensive);
    if (
      !Number.isFinite(too_cheap) ||
      !Number.isFinite(cheap) ||
      !Number.isFinite(expensive) ||
      !Number.isFinite(too_expensive)
    ) {
      continue;
    }
    rows.push({
      respondent_id: rec.respondent_id,
      too_cheap,
      cheap,
      expensive,
      too_expensive,
    });
  }
  return rows;
}

export function parseConjointCsv(text: string): CjChoice[] {
  const rows = parseCsv(text);
  if (!rows.length) coded('codebook_csv_invalid');
  const header = rows[0].map((cell) => cell.replace(/^\uFEFF/, '').toLowerCase());
  if (header.length < 2 || header[0] !== 'respondent_id' || header[1] !== 'task_id') {
    coded('codebook_csv_invalid');
  }
  const attrNames = header.slice(2);
  if (attrNames.length < CJ_MIN_ATTRIBUTES) coded('cj_too_few_attributes');
  if (attrNames.length > CJ_MAX_ATTRIBUTES) coded('cj_too_many_attributes');

  const data = rows.slice(1);
  if (data.length > MAX_DATA_ROWS) coded('codebook_row_cap');

  const records: Array<Record<string, string>> = [];
  for (const cells of data) {
    if (cells.length !== header.length) coded('codebook_csv_invalid');
    const rec: Record<string, string> = {};
    for (let i = 0; i < header.length; i += 1) {
      rec[header[i]] = cells[i] ?? '';
    }
    records.push(rec);
  }
  assertCodebookNoPii(records);

  const choices: CjChoice[] = [];
  for (const rec of records) {
    const respondent_id = String(rec.respondent_id ?? '').trim();
    const task_id = String(rec.task_id ?? '').trim();
    if (!respondent_id || !task_id) continue;
    const attributes: Record<string, string> = {};
    let valid = true;
    for (const attr of attrNames) {
      const label = String(rec[attr] ?? '').trim();
      if (!label) {
        valid = false;
        break;
      }
      attributes[attr] = label;
    }
    if (!valid) continue;
    choices.push({ respondent_id, task_id, attributes });
  }
  return choices;
}

export function conjointDraftsFromChoices(
  choices: CjChoice[],
  period_note: string,
  geography: string,
): CodebookEvidenceDraft[] {
  const drafts: CodebookEvidenceDraft[] = [];
  for (const choice of choices) {
    for (const [attr, label] of Object.entries(choice.attributes)) {
      const parsed = Number(String(label).replace(/[^\d.-]/g, ''));
      const value_num = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      drafts.push({
        locator: `C-${choice.respondent_id}:task-${choice.task_id}:${attr}`,
        value_num,
        unit: label,
        value_base: attr,
        period_note,
        geography,
        respondent_id: choice.respondent_id,
      });
    }
  }
  return drafts;
}

export function isSurveyEvidenceLocator(locator: string): boolean {
  const s = String(locator ?? '').trim();
  return (
    /^Q-\S+$/.test(s) ||
    /^R-[^:]+:[a-z_]+$/.test(s) ||
    /^C-[^:]+:task-[^:]+:.+$/.test(s)
  );
}
