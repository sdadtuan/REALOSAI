import { BdsHoldTtlJob } from './bds-hold-ttl.job';

describe('BdsHoldTtlJob', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevHoldTtl = process.env.PTT_BDS_HOLD_TTL;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevHoldTtl === undefined) delete process.env.PTT_BDS_HOLD_TTL;
    else process.env.PTT_BDS_HOLD_TTL = prevHoldTtl;
  });

  it('job tick no-ops when HOLD_TTL off', async () => {
    process.env.PTT_BDS_PACK = '1';
    delete process.env.PTT_BDS_HOLD_TTL;
    const holds = { expireDue: jest.fn() };
    await new BdsHoldTtlJob(holds as never).tick();
    expect(holds.expireDue).not.toHaveBeenCalled();
  });

  it('job tick no-ops when PACK off', async () => {
    delete process.env.PTT_BDS_PACK;
    process.env.PTT_BDS_HOLD_TTL = '1';
    const holds = { expireDue: jest.fn() };
    await new BdsHoldTtlJob(holds as never).tick();
    expect(holds.expireDue).not.toHaveBeenCalled();
  });

  it('job tick expires when PACK and HOLD_TTL on', async () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_HOLD_TTL = '1';
    const holds = { expireDue: jest.fn().mockResolvedValue(1) };
    await new BdsHoldTtlJob(holds as never).tick();
    expect(holds.expireDue).toHaveBeenCalledTimes(1);
    expect(holds.expireDue.mock.calls[0][0]).toBeInstanceOf(Date);
  });
});
