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

  it('GET hub/export kind=hdqt delegates', async () => {
    const hub = { exportHdqtCsv: jest.fn().mockResolvedValue('period,gmv\n') };
    const res = { setHeader: jest.fn() };
    const ctrl = new BdsHubController(hub as never);
    await expect(ctrl.exportHdqt('hdqt', 't1', res as never)).resolves.toBe('period,gmv\n');
    expect(hub.exportHdqtCsv).toHaveBeenCalledWith('t1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv; charset=utf-8');
  });

  it('GET hub/export rejects other kind', async () => {
    const hub = { exportHdqtCsv: jest.fn() };
    const res = { setHeader: jest.fn() };
    const ctrl = new BdsHubController(hub as never);
    await expect(ctrl.exportHdqt('receipts', 't1', res as never)).rejects.toMatchObject({
      response: { error: 'kind' },
    });
    expect(hub.exportHdqtCsv).not.toHaveBeenCalled();
  });
});
