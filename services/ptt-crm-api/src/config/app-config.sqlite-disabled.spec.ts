import { AppConfigService } from './app-config.service';

describe('AppConfigService sqliteDisabled', () => {
  const keys = [
    'PTT_SQLITE_DISABLED',
    'PTT_CRM_PAYROLL_PG',
    'PTT_LEADS_READ_SOURCE',
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of keys) prev[k] = process.env[k];
  });

  afterEach(() => {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it('sqliteDisabled false by default; payroll still default off', () => {
    delete process.env.PTT_SQLITE_DISABLED;
    delete process.env.PTT_CRM_PAYROLL_PG;
    const cfg = new AppConfigService();
    expect(cfg.sqliteDisabled).toBe(false);
    expect(cfg.crmPayrollPg).toBe(false);
  });

  it('disabled forces sqliteAvailable false even if path exists', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    const cfg = new AppConfigService();
    expect(cfg.sqliteDisabled).toBe(true);
    expect(cfg.sqliteAvailable()).toBe(false);
  });

  it('disabled forces leadsReadSource pg', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_LEADS_READ_SOURCE = 'sqlite';
    const cfg = new AppConfigService();
    expect(cfg.leadsReadSource).toBe('pg');
  });

  it('disabled forces crmPayrollPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_PAYROLL_PG = '0';
    const cfg = new AppConfigService();
    expect(cfg.crmPayrollPg).toBe(true);
  });
});
