import { BdsCollectionController } from './bds-collection.controller';

describe('BdsCollectionController', () => {
  it('createReceipt delegates to service', async () => {
    const createReceipt = jest.fn().mockResolvedValue({ id: 'r1' });
    const controller = new BdsCollectionController({ createReceipt } as never);
    await controller.createReceipt(
      { transaction_id: 'tx1', amount_vnd: 100, method: 'bank' },
      't1',
    );
    expect(createReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ transaction_id: 'tx1', amount_vnd: 100, method: 'bank' }),
      't1',
    );
  });

  it('listAging delegates to service', async () => {
    const listAging = jest.fn().mockResolvedValue([]);
    const controller = new BdsCollectionController({ listAging } as never);
    await controller.listAging(1, 't1');
    expect(listAging).toHaveBeenCalledWith(1, 't1');
  });
});
