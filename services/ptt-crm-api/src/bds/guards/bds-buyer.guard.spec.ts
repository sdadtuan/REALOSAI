import { NotFoundException } from '@nestjs/common';
import { BdsBuyerGuard } from './bds-buyer.guard';

describe('BdsBuyerGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevBuyer = process.env.PTT_BDS_BUYER;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevBuyer === undefined) delete process.env.PTT_BDS_BUYER;
    else process.env.PTT_BDS_BUYER = prevBuyer;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_BUYER = '1';
    expect(() => new BdsBuyerGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when BUYER off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_BUYER = '0';
    expect(() => new BdsBuyerGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and BUYER on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_BUYER = '1';
    expect(new BdsBuyerGuard().canActivate()).toBe(true);
  });
});
