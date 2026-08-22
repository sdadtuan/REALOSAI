import { InvoicesService } from './invoices.service';

describe('InvoicesService', () => {
  const repo = {
    list: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    createFromOrder: jest.fn(),
    issue: jest.fn(),
    patch: jest.fn(),
    voidInvoice: jest.fn(),
    syncPaidStatus: jest.fn(),
  };
  const orders = {
    getById: jest.fn(),
  };

  let service: InvoicesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InvoicesService(repo as never, orders as never);
  });

  it('issues invoice from order', () => {
    orders.getById.mockReturnValue({
      id: 3,
      customer_id: 10,
      contract_id: null,
      lifecycle_id: 7,
      total_vnd: 5_000_000,
      status: 'confirmed',
      lines: [],
    });
    repo.createFromOrder.mockReturnValue({ id: 1, invoice_number: 'INV-2026-00001', status: 'draft', due_on: '2026-08-30' });
    repo.issue.mockReturnValue({ id: 1, status: 'issued' });
    repo.getById.mockReturnValue({ id: 1, status: 'issued' });
    const out = service.createFromOrder(3, { due_on: '2026-08-30', issued_on: '2026-07-27' });
    expect(repo.createFromOrder).toHaveBeenCalled();
    expect(repo.issue).toHaveBeenCalled();
    expect(out.invoice).toBeDefined();
  });
});
