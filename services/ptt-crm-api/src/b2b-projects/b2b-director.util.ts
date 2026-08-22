export const B2B_DIRECTOR_POSITION_CODES = new Set(['gdkd-01']);

export function isB2bDirectorPosition(positionCode: string | null | undefined): boolean {
  if (!positionCode) return false;
  return B2B_DIRECTOR_POSITION_CODES.has(String(positionCode).trim().toLowerCase());
}
