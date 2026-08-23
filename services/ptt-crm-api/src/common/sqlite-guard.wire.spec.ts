import { ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CustomersSqliteRepository } from '../customers/customers-sqlite.repository';
import { PayrollSqliteRepository } from '../payroll/payroll-sqlite.repository';

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

  it('customers sqlite repo throws 503', () => {
    const repo = new CustomersSqliteRepository(new AppConfigService());
    expect(() => repo.listCustomers()).toThrow(ServiceUnavailableException);
  });

  it('payroll sqlite repo throws 503', () => {
    const repo = new PayrollSqliteRepository(new AppConfigService());
    expect(() => repo.getPolicy()).toThrow(ServiceUnavailableException);
  });
});
