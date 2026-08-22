export const INTERNAL_CODE_PREFIX = 'PTTCN';
export const INTERNAL_CODE_START = 100_001;

export function formatInternalCode(seq: number): string {
  return `${INTERNAL_CODE_PREFIX}${String(seq).padStart(6, '0')}`;
}

export function parseInternalCodeSeq(code: string): number | null {
  const match = String(code ?? '')
    .trim()
    .toUpperCase()
    .match(/^PTTCN(\d+)$/);
  if (!match) return null;
  const seq = Number(match[1]);
  return Number.isFinite(seq) ? seq : null;
}

export function nextInternalCodeFromMax(maxSeq: number | null | undefined): string {
  const next =
    maxSeq != null && maxSeq >= INTERNAL_CODE_START ? maxSeq + 1 : INTERNAL_CODE_START;
  return formatInternalCode(next);
}
