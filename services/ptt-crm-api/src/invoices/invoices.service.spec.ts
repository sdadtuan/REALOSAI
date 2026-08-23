import { AppConfigService } from '../config/app-config.service';
import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const sqlite = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    createFromOrder: jest.fn(),
    issue: jest.fn(),
    patch: jest.fn(),
    voidInvoice: jest.fn(),
    syncPaidStatus: jest.fn(),
  };
  const pg = { ...sqlite };
  const ordersSqlite = { getById: jest.fn() };
  const ordersPg = { getById: jest.fn() };
  const config = { crmInvoicesPg: false, crmOrdersPg: false } as AppConfigService;

  let service: InvoicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoicesService(
      sqlite as never,
      pg as never,
      ordersSqlite as never,
      ordersPg as never,
      config,
    );
  });

  it('issues invoice from order via sqlite', async () => {
    ordersSqlite.getById.mockReturnValue({
      id: 3,
      customer_id: 10,
      contract_id: null,
      lifecycle_id: 7,
      total_vnd: 5_000_000,
      status: 'confirmed',
      lines: [],
    });
    sqlite.createFromOrder.mockReturnValue({
      id: 1,
      invoice_number: 'INV-2026-00001',
      status: 'draft',
      due_on: '2026-08-30',
    });
    sqlite.issue.mockReturnValue({ id: 1, status: 'issued' });
    sqlite.getById.mockReturnValue({ id: 1, status: 'issued' });
    const out = await service.createFromOrder(3, { due_on: '2026-08-30', issued_on: '2026-07-27' });
    expect(sqlite.createFromOrder).toHaveBeenCalled();
    expect(sqlite.issue).toHaveBeenCalled();
    expect(out.invoice).toBeDefined();
  });
});
