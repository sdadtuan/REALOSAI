import type { LmpRedFlagItem } from './lmp-sci-slice.util';

export interface SciRedFlagBlockInfo {
  active: boolean;
  reason: string;
  flags: LmpRedFlagItem[];
}

function asRecord(val: unknown): Record<string, unknown> | null {
  return val && typeof val === 'object' && !Array.isArray(val) ? (val as Record<string, unknown>) : null;
}

export function extractBlockingRedFlagsFromSci(
  sci: Record<string, unknown> | null | undefined,
): LmpRedFlagItem[] {
  if (!sci) return [];
  const raw = Array.isArray(sci.red_flags) ? sci.red_flags : [];
  const flags: LmpRedFlagItem[] = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const severity = String(row.severity ?? 'warn').trim().toLowerCase();
    if (severity !== 'block') continue;
    const flag_vi = String(row.flag_vi ?? '').trim();
    if (!flag_vi) continue;
    flags.push({
      flag_vi,
      severity: 'block',
      mitigation_vi: String(row.mitigation_vi ?? '').trim(),
    });
  }
  return flags;
}

export function buildSciRedFlagBlockReason(flags: LmpRedFlagItem[]): string {
  if (!flags.length) return '';
  const labels = flags.map((f) => f.flag_vi).join('; ');
  return `SCI red flag block: ${labels} — cần GDKD override trước khi tạo báo giá.`;
}

export function buildSciRedFlagBlockInfo(
  sci: Record<string, unknown> | null | undefined,
): SciRedFlagBlockInfo {
  const flags = extractBlockingRedFlagsFromSci(sci);
  return {
    active: flags.length > 0,
    reason: buildSciRedFlagBlockReason(flags),
    flags,
  };
}
