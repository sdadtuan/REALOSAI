import { AppConfigService } from '../config/app-config.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  const sqlite = {
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
  const config = { crmOrdersPg: false } as AppConfigService;

  let service: OrdersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(sqlite as never, pg as never, config);
  });

  it('creates order for valid customer via sqlite', async () => {
    sqlite.customerExists.mockReturnValue(true);
    sqlite.create.mockReturnValue({ id: 1, reference_code: 'SO-2026-00001', status: 'draft' });
    const out = await service.create({ customer_id: 10 });
    expect(out.order.id).toBe(1);
    expect(sqlite.create).toHaveBeenCalled();
  });

  it('converts proposal to order via sqlite', async () => {
    sqlite.createFromProposal.mockReturnValue({ id: 2, proposal_id: 5, status: 'draft' });
    const out = await service.convertFromProposal(5);
    expect(out.order.proposal_id).toBe(5);
  });

  it('routes list to pg when flag on', async () => {
    (config as { crmOrdersPg: boolean }).crmOrdersPg = true;
    pg.list.mockResolvedValue([{ id: 9 }]);
    const out = await service.list({});
    expect(out.orders).toEqual([{ id: 9 }]);
    expect(pg.list).toHaveBeenCalled();
    expect(sqlite.list).not.toHaveBeenCalled();
  });
});
