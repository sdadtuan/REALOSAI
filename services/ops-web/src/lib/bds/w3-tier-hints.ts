import type { BdsAgency } from './types';

export function uniqueTierIdsFromAgencies(agencies: BdsAgency[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of agencies) {
    const id = String(row.tier_id ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
