import { BdsOrgController } from './bds-org.controller';

describe('BdsOrgController', () => {
  it('GET g0 delegates', async () => {
    const g0Service = {
      getG0Status: jest.fn().mockResolvedValue({ ready: false, missing_position_codes: ['gdkd'] }),
    };
    const ctrl = new BdsOrgController(g0Service as never);
    await expect(ctrl.g0()).resolves.toEqual({ ready: false, missing_position_codes: ['gdkd'] });
    expect(g0Service.getG0Status).toHaveBeenCalled();
  });
});
