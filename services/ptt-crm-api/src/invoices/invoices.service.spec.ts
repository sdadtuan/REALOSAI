import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const pg = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    createFromOrder: jest.fn(),
    issue: jest.fn(),
    patch: jest.fn(),
    voidInvoice: jest.fn(),
    syncPaidStatus: jest.fn(),
  };
  const ordersPg = { getById: jest.fn() };

  let service: InvoicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoicesService(pg as never, ordersPg as never);
  });

  it('issues invoice from order via pg', async () => {
    ordersPg.getById.mockResolvedValue({
      id: 3,
      customer_id: 10,
      contract_id: null,
      lifecycle_id: 7,
      total_vnd: 5_000_000,
      status: 'confirmed',
      lines: [],
    });
    pg.createFromOrder.mockResolvedValue({
      id: 1,
      invoice_number: 'INV-2026-00001',
      status: 'draft',
      due_on: '2026-08-30',
    });
    pg.issue.mockResolvedValue({ id: 1, status: 'issued' });
    pg.getById.mockResolvedValue({ id: 1, status: 'issued' });
    const out = await service.createFromOrder(3, { due_on: '2026-08-30', issued_on: '2026-07-27' });
    expect(pg.createFromOrder).toHaveBeenCalled();
    expect(pg.issue).toHaveBeenCalled();
    expect(out.invoice).toBeDefined();
  });
});
