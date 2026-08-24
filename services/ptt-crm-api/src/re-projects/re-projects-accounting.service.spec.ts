import { ServiceUnavailableException } from '@nestjs/common';
import { ReProjectsAccountingService } from './re-projects-accounting.service';

describe('ReProjectsAccountingService sqlite-off routing', () => {
  const accountingPg = { nowTs: jest.fn().mockReturnValue('2026-01-01') };
  const pgOltp = {};
  const productPg = {};
  const kpiBudgetPg = {};

  it('throws when sqlite disabled and PG is not primary', () => {
    const service = new ReProjectsAccountingService(
      { sqliteDisabled: true } as never,
      accountingPg as never,
      pgOltp as never,
      productPg as never,
      kpiBudgetPg as never,
    );

    expect(() => service['deps']()).toThrow(ServiceUnavailableException);
  });
});
