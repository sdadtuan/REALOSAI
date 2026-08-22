import { isBdsPgEnabled } from '../bds.flags';

export function shouldDualWrite(): boolean {
  return isBdsPgEnabled();
}

export function assertCountGate(sqliteCount: number, pgCount: number): void {
  if (sqliteCount !== pgCount) {
    throw new Error(`BDS-20 count mismatch sqlite=${sqliteCount} pg=${pgCount}`);
  }
}
