import { BdsLaunchController } from './bds-launch.controller';

describe('BdsLaunchController', () => {
  it('open delegates id + tenant', async () => {
    const svc = { open: jest.fn().mockResolvedValue({ id: 'L1', status: 'open' }) };
    const ctl = new BdsLaunchController(svc as never);
    await ctl.open('L1', 't1');
    expect(svc.open).toHaveBeenCalledWith('L1', 't1');
  });
});
