import { AppConfigService } from '../config/app-config.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const pg = {
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
    service = new OrdersService(pg as never);
  });

  it('creates order for valid customer via pg', async () => {
    pg.customerExists.mockResolvedValue(true);
    pg.create.mockResolvedValue({ id: 1, reference_code: 'SO-2026-00001', status: 'draft' });
    const out = await service.create({ customer_id: 10 });
    expect(out.order.id).toBe(1);
    expect(pg.create).toHaveBeenCalled();
  });

  it('converts proposal to order via pg', async () => {
    pg.createFromProposal.mockResolvedValue({ id: 2, proposal_id: 5, status: 'draft' });
    const out = await service.convertFromProposal(5);
    expect(out.order.proposal_id).toBe(5);
  });

  it('lists orders via pg', async () => {
    pg.list.mockResolvedValue([{ id: 9 }]);
    const out = await service.list({});
    expect(out.orders).toEqual([{ id: 9 }]);
    expect(pg.list).toHaveBeenCalled();
  });
});
