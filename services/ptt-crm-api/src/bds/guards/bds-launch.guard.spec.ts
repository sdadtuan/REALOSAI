import { NotFoundException } from '@nestjs/common';
import { BdsLaunchGuard } from './bds-launch.guard';

describe('BdsLaunchGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevLaunch = process.env.PTT_BDS_LAUNCH;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevLaunch === undefined) delete process.env.PTT_BDS_LAUNCH;
    else process.env.PTT_BDS_LAUNCH = prevLaunch;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_LAUNCH = '1';
    expect(() => new BdsLaunchGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when LAUNCH off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_LAUNCH = '0';
    expect(() => new BdsLaunchGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and LAUNCH on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_LAUNCH = '1';
    expect(new BdsLaunchGuard().canActivate()).toBe(true);
  });
});
