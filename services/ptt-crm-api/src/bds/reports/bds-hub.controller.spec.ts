import { BdsHubController } from './bds-hub.controller';

describe('BdsHubController', () => {
  it('GET hub delegates', async () => {
    const hub = { getHub: jest.fn().mockResolvedValue({ mode: 'developer' }) };
    const ctrl = new BdsHubController(hub as never);
    await expect(ctrl.hub('t1')).resolves.toEqual({ mode: 'developer' });
    expect(hub.getHub).toHaveBeenCalledWith('t1');
  });

  it('GET leaderboard delegates', async () => {
    const hub = { listLeaderboard: jest.fn().mockResolvedValue([]) };
    const ctrl = new BdsHubController(hub as never);
    await expect(ctrl.leaderboard('2026-08-01', 't1')).resolves.toEqual([]);
    expect(hub.listLeaderboard).toHaveBeenCalledWith('2026-08-01', 't1');
  });
});
