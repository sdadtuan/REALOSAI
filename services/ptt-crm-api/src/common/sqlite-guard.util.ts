import { ServiceUnavailableException } from '@nestjs/common';

export const SQLITE_DISABLED_ERROR = 'sqlite_disabled';

export function isSqliteDisabled(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(
    (process.env.PTT_SQLITE_DISABLED ?? '0').trim().toLowerCase(),
  );
}

export function assertSqliteAllowed(): void {
  if (!isSqliteDisabled()) return;
  throw new ServiceUnavailableException({
    error: SQLITE_DISABLED_ERROR,
    hint: 'OLTP uses PostgreSQL only. Set PTT_CRM_*_PG=1 or apply missing DDL.',
  });
}
