import { BdsCommissionController } from './bds-commission.controller';

describe('BdsCommissionController', () => {
  it('delegates createScheme', async () => {
    const commission = {
      createScheme: jest.fn().mockResolvedValue({ id: 's1' }),
      putTiers: jest.fn(),
      putSplits: jest.fn(),
      activate: jest.fn(),
      listCommissions: jest.fn(),
      lockStatement: jest.fn(),
      approveStatement: jest.fn(),
      payStatement: jest.fn(),
      createAdvance: jest.fn(),
    };
    const score = { recalc: jest.fn() };
    const ctrl = new BdsCommissionController(commission as never, score as never);
    await expect(ctrl.createScheme({ project_id: 12 }, 't1')).resolves.toEqual({ id: 's1' });
    expect(commission.createScheme).toHaveBeenCalledWith({ project_id: 12 }, 't1');
  });
});
