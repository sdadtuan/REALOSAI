import { BdsAgencyController } from './bds-agency.controller';

describe('BdsAgencyController', () => {
  it('create delegates to service', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'a1', code: 'F1' });
    const controller = new BdsAgencyController({ create } as never);
    await controller.create({ code: 'F1' }, 't1');
    expect(create).toHaveBeenCalledWith({ code: 'F1' }, 't1');
  });

  it('grantUnits delegates to service', async () => {
    const grantUnits = jest.fn().mockResolvedValue([{ product_id: 9 }]);
    const controller = new BdsAgencyController({ grantUnits } as never);
    await controller.grantUnits(
      'a1',
      { project_id: 1, product_ids: [9], exclusivity: 'shared' },
      't1',
    );
    expect(grantUnits).toHaveBeenCalledWith(
      'a1',
      { project_id: 1, product_ids: [9], exclusivity: 'shared' },
      't1',
    );
  });

  it('meBasket delegates to service', async () => {
    const listBasket = jest.fn().mockResolvedValue([{ product_id: 9 }]);
    const controller = new BdsAgencyController({ listBasket } as never);
    await controller.meBasket('a1', 't1', '1');
    expect(listBasket).toHaveBeenCalledWith('a1', 1, 't1');
  });
});
