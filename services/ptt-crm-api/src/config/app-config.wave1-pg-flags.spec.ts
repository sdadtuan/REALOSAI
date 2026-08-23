import { AppConfigService } from './app-config.service';

describe('AppConfigService wave1 PG flags', () => {
  const keys = [
    'PTT_SQLITE_DISABLED',
    'PTT_CRM_CUSTOMERS_PG',
    'PTT_CRM_CASES_PG',
    'PTT_CRM_TICKETS_PG',
    'PTT_CRM_PROPOSALS_PG',
    'PTT_CRM_MARKETING_PLANS_PG',
    'PTT_CRM_CONFIG_PG',
    'PTT_CRM_ORDERS_PG',
    'PTT_CRM_INVOICES_PG',
    'PTT_CRM_SALES_PG',
    'PTT_CRM_OWNER_WEEKLY_PG',
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

  it('crmCustomersPg false by default', () => {
    delete process.env.PTT_SQLITE_DISABLED;
    delete process.env.PTT_CRM_CUSTOMERS_PG;
    expect(new AppConfigService().crmCustomersPg).toBe(false);
  });

  it('sqlite disabled forces crmCustomersPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_CUSTOMERS_PG = '0';
    expect(new AppConfigService().crmCustomersPg).toBe(true);
  });

  it('explicit flag enables crmCasesPg when sqlite allowed', () => {
    delete process.env.PTT_SQLITE_DISABLED;
    process.env.PTT_CRM_CASES_PG = '1';
    expect(new AppConfigService().crmCasesPg).toBe(true);
  });

  it('sqlite disabled forces crmTicketsPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_TICKETS_PG = '0';
    expect(new AppConfigService().crmTicketsPg).toBe(true);
  });

  it('explicit flag enables crmProposalsPg when sqlite allowed', () => {
    delete process.env.PTT_SQLITE_DISABLED;
    process.env.PTT_CRM_PROPOSALS_PG = '1';
    expect(new AppConfigService().crmProposalsPg).toBe(true);
  });

  it('sqlite disabled forces crmConfigPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_CONFIG_PG = '0';
    expect(new AppConfigService().crmConfigPg).toBe(true);
  });

  it('explicit flag enables crmOrdersPg when sqlite allowed', () => {
    delete process.env.PTT_SQLITE_DISABLED;
    process.env.PTT_CRM_ORDERS_PG = '1';
    expect(new AppConfigService().crmOrdersPg).toBe(true);
  });

  it('sqlite disabled forces crmInvoicesPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_INVOICES_PG = '0';
    expect(new AppConfigService().crmInvoicesPg).toBe(true);
  });

  it('sqlite disabled forces crmSalesPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_SALES_PG = '0';
    expect(new AppConfigService().crmSalesPg).toBe(true);
  });

  it('sqlite disabled forces crmOwnerWeeklyPg true', () => {
    process.env.PTT_SQLITE_DISABLED = '1';
    process.env.PTT_CRM_OWNER_WEEKLY_PG = '0';
    expect(new AppConfigService().crmOwnerWeeklyPg).toBe(true);
  });
});
