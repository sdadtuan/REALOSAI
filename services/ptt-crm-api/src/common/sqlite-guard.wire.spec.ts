import { ServiceUnavailableException } from '@nestjs/common';
import { assertSqliteAllowed } from './sqlite-guard.util';

describe('sqlite guard wire', () => {
  const KEY = 'PTT_SQLITE_DISABLED';
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[KEY];
    process.env[KEY] = '1';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });

  it('assertSqliteAllowed throws 503 when sqlite disabled', () => {
    expect(() => assertSqliteAllowed()).toThrow(ServiceUnavailableException);
  });
});
