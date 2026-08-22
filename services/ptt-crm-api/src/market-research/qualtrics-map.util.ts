import type { QualtricsColumnMapEntry, ResearchStudy } from './market-research.types';

export function resolveQualtricsColumnMap(
  study: ResearchStudy,
  bodyMap?: Record<string, QualtricsColumnMapEntry> | null,
): Record<string, QualtricsColumnMapEntry> | null {
  if (bodyMap && Object.keys(bodyMap).length > 0) return bodyMap;
  const note = String(study.weighting_note ?? '').trim();
  if (!note) return null;
  try {
    const parsed = JSON.parse(note) as Record<string, unknown>;
    const map = parsed.qualtrics_column_map;
    if (map && typeof map === 'object' && Object.keys(map as object).length > 0) {
      return map as Record<string, QualtricsColumnMapEntry>;
    }
  } catch {
    return null;
  }
  return null;
}
