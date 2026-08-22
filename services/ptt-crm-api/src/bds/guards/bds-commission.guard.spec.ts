import { NotFoundException } from '@nestjs/common';
import { BdsCommissionGuard } from './bds-commission.guard';

describe('BdsCommissionGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevCommission = process.env.PTT_BDS_COMMISSION;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevCommission === undefined) delete process.env.PTT_BDS_COMMISSION;
    else process.env.PTT_BDS_COMMISSION = prevCommission;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_COMMISSION = '1';
    expect(() => new BdsCommissionGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when COMMISSION off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_COMMISSION = '0';
    expect(() => new BdsCommissionGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and COMMISSION on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_COMMISSION = '1';
    expect(new BdsCommissionGuard().canActivate()).toBe(true);
  });
});
