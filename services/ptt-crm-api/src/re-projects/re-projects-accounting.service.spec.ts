import { ServiceUnavailableException } from '@nestjs/common';
import { ReProjectsAccountingService } from './re-projects-accounting.service';

describe('ReProjectsAccountingService sqlite-off routing', () => {
  const accountingSqlite = { nowTs: jest.fn().mockReturnValue('2026-01-01') };
  const projectsSqlite = {};

  it('throws when sqlite disabled and PG is not primary', () => {
    const service = new ReProjectsAccountingService(
      accountingSqlite as never,
      projectsSqlite as never,
      { sqliteDisabled: true } as never,
    );

    expect(() => service['deps']()).toThrow(ServiceUnavailableException);
  });
});
