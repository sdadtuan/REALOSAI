import { ServiceUnavailableException } from '@nestjs/common';
import { assertSqliteAllowed, isSqliteDisabled, SQLITE_DISABLED_ERROR } from './sqlite-guard.util';

describe('sqlite-guard', () => {
  const KEY = 'PTT_SQLITE_DISABLED';
  let prev: string | undefined;

  beforeEach(() => {
    prev = process.env[KEY];
  });

  afterEach(() => {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  });

  it('isSqliteDisabled false by default', () => {
    delete process.env[KEY];
    expect(isSqliteDisabled()).toBe(false);
  });

  it('isSqliteDisabled true for 1/true/yes/on', () => {
    for (const v of ['1', 'true', 'YES', 'on']) {
      process.env[KEY] = v;
      expect(isSqliteDisabled()).toBe(true);
    }
  });

  it('assertSqliteAllowed is no-op when unset', () => {
    delete process.env[KEY];
    expect(() => assertSqliteAllowed()).not.toThrow();
  });

  it('assertSqliteAllowed throws 503 body when disabled', () => {
    process.env[KEY] = '1';
    try {
      assertSqliteAllowed();
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      const body = (err as ServiceUnavailableException).getResponse() as {
        error: string;
        hint: string;
      };
      expect(body.error).toBe(SQLITE_DISABLED_ERROR);
      expect(body.hint).toMatch(/PostgreSQL/i);
    }
  });
});
