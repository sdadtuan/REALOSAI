import { NotFoundException } from '@nestjs/common';
import { BdsAftersalesGuard } from './bds-aftersales.guard';

describe('BdsAftersalesGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevAftersales = process.env.PTT_BDS_AFTERSALES;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevAftersales === undefined) delete process.env.PTT_BDS_AFTERSALES;
    else process.env.PTT_BDS_AFTERSALES = prevAftersales;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_AFTERSALES = '1';
    expect(() => new BdsAftersalesGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when AFTERSALES off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_AFTERSALES = '0';
    expect(() => new BdsAftersalesGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and AFTERSALES on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_AFTERSALES = '1';
    expect(new BdsAftersalesGuard().canActivate()).toBe(true);
  });
});
