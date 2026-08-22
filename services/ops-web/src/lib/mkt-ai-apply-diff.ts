import { STRATEGY_FIELD_ORDER, TMMT_PROF_FIELD_ORDER } from './mkt-ai-draft-fields';
import { STRATEGY_LABELS, TMMT_PROF_LABELS } from './tmmt-labels';

export interface TmmtFieldDiff {
  key: string;
  label: string;
  section: 'strategy' | 'prof';
  official: string;
  draft: string;
  changed: boolean;
}

export function buildTmmtApplyDiff(
  officialSf: Record<string, string> | undefined,
  officialProf: Record<string, string> | undefined,
  draftSf: Record<string, string> | undefined,
  draftProf: Record<string, string> | undefined,
): TmmtFieldDiff[] {
  const diffs: TmmtFieldDiff[] = [];
  const osf = officialSf ?? {};
  const oprof = officialProf ?? {};
  const dsf = draftSf ?? {};
  const dprof = draftProf ?? {};

  for (const key of STRATEGY_FIELD_ORDER) {
    const official = String(osf[key] ?? '').trim();
    const draft = String(dsf[key] ?? '').trim();
    if (!draft && !official) continue;
    diffs.push({
      key,
      label: STRATEGY_LABELS[key] ?? key,
      section: 'strategy',
      official,
      draft,
      changed: official !== draft,
    });
  }

  for (const key of TMMT_PROF_FIELD_ORDER) {
    const official = String(oprof[key] ?? '').trim();
    const draft = String(dprof[key] ?? '').trim();
    if (!draft && !official) continue;
    diffs.push({
      key,
      label: TMMT_PROF_LABELS[key] ?? key,
      section: 'prof',
      official,
      draft,
      changed: official !== draft,
    });
  }

  return diffs;
}

export function summarizeApplyDiff(diffs: TmmtFieldDiff[]): {
  changedCount: number;
  newFields: number;
  previewLines: string[];
} {
  let changedCount = 0;
  let newFields = 0;
  const previewLines: string[] = [];

  for (const d of diffs) {
    if (d.changed) changedCount++;
    if (!d.official && d.draft) newFields++;
    if (d.draft) {
      previewLines.push(`+ ${d.label} (${d.draft.length} ký tự)`);
    }
  }

  return { changedCount, newFields, previewLines: previewLines.slice(0, 6) };
}

export function truncatePreview(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}
