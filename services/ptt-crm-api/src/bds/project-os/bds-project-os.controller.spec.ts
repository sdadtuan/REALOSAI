import { BdsProjectOsController } from './bds-project-os.controller';

describe('BdsProjectOsController', () => {
  it('openPhase forwards id and tenant to service', async () => {
    const projectOs = { openPhase: jest.fn().mockResolvedValue({ id: 'p1', status: 'active' }) };
    const ctl = new BdsProjectOsController(projectOs as never);
    await expect(ctl.openPhase('p1', 't1')).resolves.toEqual({ id: 'p1', status: 'active' });
    expect(projectOs.openPhase).toHaveBeenCalledWith('p1', 't1');
  });
});
