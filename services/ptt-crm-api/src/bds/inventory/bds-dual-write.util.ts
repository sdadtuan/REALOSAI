import { isBdsPackEnabled, isBdsPgEnabled } from '../bds.flags';

/** SQLite → PG mirror (legacy cutover). Off when PG is OLTP primary. */
export function shouldDualWrite(): boolean {
  return isBdsPgEnabled() && !isReProjectsPgPrimary();
}

/** RE projects CRUD reads/writes PostgreSQL only (no SQLite). */
export function isReProjectsPgPrimary(): boolean {
  return isBdsPackEnabled() && isBdsPgEnabled();
}

/** Alias: BĐS OLTP on PostgreSQL — SQLite banned for pack routes. */
export function isBdsPgOltp(): boolean {
  return isReProjectsPgPrimary();
}

export function assertCountGate(sqliteCount: number, pgCount: number): void {
  if (sqliteCount !== pgCount) {
    throw new Error(`BDS-20 count mismatch sqlite=${sqliteCount} pg=${pgCount}`);
  }
}
