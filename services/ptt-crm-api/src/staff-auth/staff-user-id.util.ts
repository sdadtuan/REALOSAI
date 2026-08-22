/** Parse JWT `sub` when it is already a numeric crm_staff id. */
export function parseNumericStaffSub(sub: string | undefined | null): number | null {
  if (sub == null || sub === '') return null;
  const trimmed = String(sub).trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Never pass NaN/invalid values to PG bigint columns. */
export function sanitizePgBigintUserId(userId: number | null | undefined): number | null {
  if (userId == null) return null;
  return Number.isFinite(userId) && userId > 0 ? Math.trunc(userId) : null;
}
