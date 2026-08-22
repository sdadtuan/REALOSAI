import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const repo = {
    list: jest.fn(),
    getById: jest.fn(),
    customerExists: jest.fn(),
    create: jest.fn(),
    createFromProposal: jest.fn(),
    patch: jest.fn(),
    setStatus: jest.fn(),
    addLine: jest.fn(),
    deleteLine: jest.fn(),
  };

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(repo as never);
  });

  it('creates order for valid customer', () => {
    repo.customerExists.mockReturnValue(true);
    repo.create.mockReturnValue({ id: 1, reference_code: 'SO-2026-00001', status: 'draft' });
    const out = service.create({ customer_id: 10 });
    expect(out.order.id).toBe(1);
    expect(repo.create).toHaveBeenCalled();
  });

  it('converts proposal to order', () => {
    repo.createFromProposal.mockReturnValue({ id: 2, proposal_id: 5, status: 'draft' });
    const out = service.convertFromProposal(5);
    expect(out.order.proposal_id).toBe(5);
  });
});
