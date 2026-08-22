import { NotFoundException } from '@nestjs/common';
import { BdsProjectOsGuard } from './bds-project-os.guard';

describe('BdsProjectOsGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevProjectOs = process.env.PTT_BDS_PROJECT_OS;
  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevProjectOs === undefined) delete process.env.PTT_BDS_PROJECT_OS;
    else process.env.PTT_BDS_PROJECT_OS = prevProjectOs;
  });

  it('throws NotFoundException when PACK is off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_PROJECT_OS = '1';
    expect(() => new BdsProjectOsGuard().canActivate()).toThrow(NotFoundException);
  });

  it('throws NotFoundException when PROJECT_OS is off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_PROJECT_OS = '0';
    expect(() => new BdsProjectOsGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and PROJECT_OS are on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_PROJECT_OS = '1';
    expect(new BdsProjectOsGuard().canActivate()).toBe(true);
  });
});
