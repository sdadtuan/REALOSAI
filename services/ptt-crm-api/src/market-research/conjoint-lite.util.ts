import { assertNoFakeConfidence } from './confidence-rubric.util';
import {
  CJ_LIMITATION,
  CJ_MAX_ATTRIBUTES,
  CJ_MIN_ATTRIBUTES,
  type CjAttributeSummary,
  type CjChoice,
  type CjSummary,
} from './market-research.types';

function coded(code: string): never {
  throw Object.assign(new Error(code), { code });
}

const LOCATOR_RE = /^C-(.+):task-([^:]+):(.+)$/;

export function choicesFromCjEvidence(
  rows: Array<{
    value_num: number | null;
    value_base: string;
    locator: string;
    unit: string | null;
  }>,
): CjChoice[] {
  const groups = new Map<
    string,
    { respondent_id: string; task_id: string; attributes: Record<string, string> }
  >();

  for (const row of rows) {
    const match = String(row.locator ?? '').trim().match(LOCATOR_RE);
    if (!match) continue;
    const respondent_id = match[1];
    const task_id = match[2];
    const attrFromLocator = match[3];
    const attrName = String(row.value_base ?? '').trim() || attrFromLocator;
    const label = String(row.unit ?? '').trim();
    if (!attrName || !label) continue;

    const key = `${respondent_id}\0${task_id}`;
    const current = groups.get(key) ?? { respondent_id, task_id, attributes: {} };
    current.attributes[attrName] = label;
    groups.set(key, current);
  }

  return [...groups.values()].filter((choice) => Object.keys(choice.attributes).length > 0);
}

export function computeConjointLite(choices: CjChoice[]): Omit<CjSummary, 'id' | 'project_id' | 'study_id' | 'created_by' | 'created_at'> {
  const n_choices = choices.length;
  const n = new Set(choices.map((choice) => choice.respondent_id)).size;
  if (n_choices < 4) coded('cj_insufficient_choices');
  if (n < 4) coded('cj_insufficient_n');

  const attrNames = [...new Set(choices.flatMap((choice) => Object.keys(choice.attributes)))].sort();
  if (attrNames.length < CJ_MIN_ATTRIBUTES) coded('cj_too_few_attributes');
  if (attrNames.length > CJ_MAX_ATTRIBUTES) coded('cj_too_many_attributes');

  const attributes: CjAttributeSummary[] = attrNames.map((name) => {
    const counts = new Map<string, number>();
    for (const choice of choices) {
      const label = choice.attributes[name];
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const levels = [...counts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        share_pct: n_choices > 0 ? (100 * count) / n_choices : 0,
      }))
      .sort((a, b) => b.share_pct - a.share_pct || a.label.localeCompare(b.label));
    const top_level = levels[0]?.label ?? null;
    return { name, levels, top_level };
  });

  const recommendation = {
    levels: attributes
      .filter((attr) => attr.top_level)
      .map((attr) => ({
        attribute: attr.name,
        level: attr.top_level as string,
        share_pct: attr.levels.find((level) => level.label === attr.top_level)?.share_pct ?? 0,
      })),
  };

  const out = {
    n,
    n_choices,
    attributes,
    recommendation,
    limitation_note: CJ_LIMITATION,
    statistical_inference: false as const,
  };
  assertNoFakeConfidence(
    JSON.stringify({ n: out.n, n_choices: out.n_choices, attributes: out.attributes }),
    false,
  );
  return out;
}
