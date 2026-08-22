import { assertNoFakeConfidence } from './confidence-rubric.util';
import {
  CJ_WHATIF_LIMITATION,
  type CjChoice,
  type CjWhatIfResult,
} from './market-research.types';

function coded(code: string): never {
  throw Object.assign(new Error(code), { code });
}

export function simulateConjointWhatIf(
  choices: CjChoice[],
  scenario: Record<string, string>,
): CjWhatIfResult {
  if (!Array.isArray(choices) || choices.length === 0) coded('cj_whatif_no_choices');
  const pairs = Object.entries(scenario ?? {}).filter(
    ([key, value]) => key.trim() !== '' && String(value).trim() !== '',
  );
  if (pairs.length === 0) coded('cj_whatif_empty');
  const known = new Set(choices.flatMap((choice) => Object.keys(choice.attributes)));
  for (const [attr] of pairs) {
    if (!known.has(attr)) coded('cj_whatif_unknown_attribute');
  }
  const n_choices = choices.length;
  const n_match = choices.filter((choice) =>
    pairs.every(([attr, level]) => choice.attributes[attr] === String(level).trim()),
  ).length;
  const out: CjWhatIfResult = {
    n_match,
    n_choices,
    match_pct: (100 * n_match) / n_choices,
    scenario: Object.fromEntries(pairs.map(([key, value]) => [key, String(value).trim()])),
    limitation_note: CJ_WHATIF_LIMITATION,
    statistical_inference: false,
  };
  assertNoFakeConfidence(
    JSON.stringify({ n_match: out.n_match, n_choices: out.n_choices, match_pct: out.match_pct }),
    false,
  );
  return out;
}
