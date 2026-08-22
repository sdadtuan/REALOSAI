import { BdsPolicyController } from './bds-policy.controller';
import { BdsPolicyService } from './bds-policy.service';

describe('BdsPolicyController', () => {
  it('create delegates to service', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'p1' });
    const controller = new BdsPolicyController({ create } as never);
    await controller.createPolicy(9, { code: 'A' }, 't1');
    expect(create).toHaveBeenCalledWith(9, { code: 'A' }, 't1');
  });

  it('activate delegates to service', async () => {
    const activate = jest.fn().mockResolvedValue({ id: 'p1', status: 'active' });
    const controller = new BdsPolicyController({ activate } as never);
    await controller.activate(
      'p1',
      { phase_id: 'ph1', price_list_id: 3, actor_role: 'cdt_sales_dir' },
      't1',
    );
    expect(activate).toHaveBeenCalledWith(
      'p1',
      {
        phase_id: 'ph1',
        price_list_id: 3,
        actor_role: 'cdt_sales_dir',
        activated_by: undefined,
      },
      't1',
    );
  });
});
