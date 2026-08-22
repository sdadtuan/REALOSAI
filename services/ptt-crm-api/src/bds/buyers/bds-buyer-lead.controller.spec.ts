import { BdsBuyerLeadController } from './bds-buyer-lead.controller';

describe('BdsBuyerLeadController', () => {
  it('list delegates to service', async () => {
    const list = jest.fn().mockResolvedValue([]);
    const controller = new BdsBuyerLeadController(
      { list } as never,
      {} as never,
      {} as never,
    );
    await controller.list(12, 't1', undefined, { staffAuthVia: 'internal' } as never);
    expect(list).toHaveBeenCalledWith(12, 't1', expect.objectContaining({ viewAll: true }));
  });

  it('qualify delegates to service', async () => {
    const qualify = jest.fn().mockResolvedValue({ buyer_id: 'b1' });
    const controller = new BdsBuyerLeadController(
      { qualify } as never,
      {} as never,
      {} as never,
    );
    await controller.qualify(1, { status: 'da_lien_he' }, 't1');
    expect(qualify).toHaveBeenCalledWith(1, { status: 'da_lien_he' }, 't1', expect.any(Object));
  });
});
