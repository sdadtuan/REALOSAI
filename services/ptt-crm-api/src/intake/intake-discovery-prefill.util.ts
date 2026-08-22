import { extractDiscoveryResponseSnippets } from './intake-answers.util';

function asStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function formatStakeholders(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const lines: string[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? row.full_name ?? '').trim();
    const role = String(row.role ?? row.title ?? '').trim();
    const influence = String(row.influence ?? row.decision_power ?? '').trim();
    const parts = [name, role, influence].filter(Boolean);
    if (parts.length) lines.push(parts.join(' · '));
  }
  return lines.slice(0, 8);
}

export function buildDiscoveryConsultPrefill(input: {
  answers?: Record<string, unknown>;
  stakeholdersJson?: unknown;
}): { currentStatusLines: string[]; noteLines: string[] } {
  const answers = input.answers ?? {};
  const currentStatusLines: string[] = [];
  const noteLines: string[] = [];

  const snippets = extractDiscoveryResponseSnippets(answers, 8);
  for (const snippet of snippets) {
    currentStatusLines.push(`Discovery: ${snippet}`);
  }

  const redFlags = asStringList(answers.red_flags);
  if (redFlags.length) {
    noteLines.push(`Red flags: ${redFlags.join('; ')}`);
  }

  const stakeholders = formatStakeholders(input.stakeholdersJson);
  if (stakeholders.length) {
    noteLines.push(`Stakeholders: ${stakeholders.join(' | ')}`);
  }

  const commitments = answers.commitments;
  if (Array.isArray(commitments) && commitments.length) {
    const commitLines = commitments
      .map((item) => {
        if (!item || typeof item !== 'object') return '';
        const row = item as Record<string, unknown>;
        return String(row.text ?? row.commitment ?? row.label ?? '').trim();
      })
      .filter(Boolean)
      .slice(0, 4);
    if (commitLines.length) {
      noteLines.push(`Cam kết KH: ${commitLines.join('; ')}`);
    }
  }

  return { currentStatusLines, noteLines };
}
