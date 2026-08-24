import { ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { SqliteLeadsRepository } from '../leads/sqlite-leads.repository';

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

  it('leads sqlite repo throws 503', () => {
    const repo = new SqliteLeadsRepository(new AppConfigService());
    expect(() => repo.listLeads({})).toThrow(ServiceUnavailableException);
  });
});
