/**
 * Minimal sqlite sync DB surface for legacy test helpers (W4b).
 * Production OLTP uses PostgreSQL; DatabaseSync from node:sqlite is only used in *.spec.ts cores.
 */
export type SqliteInputValue = string | number | bigint | Uint8Array | null;

export interface SqliteSyncStatement {
  all(...params: SqliteInputValue[]): unknown[];
  get(...params: SqliteInputValue[]): unknown;
  run(...params: SqliteInputValue[]): { changes: number | bigint; lastInsertRowid?: number | bigint };
}

export interface SqliteSyncDb {
  prepare(sql: string): SqliteSyncStatement;
  exec(sql: string): void;
}
