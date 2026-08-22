import { NotFoundException } from '@nestjs/common';
import { BdsTxGuard } from './bds-tx.guard';

describe('BdsTxGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevTx = process.env.PTT_BDS_TX;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevTx === undefined) delete process.env.PTT_BDS_TX;
    else process.env.PTT_BDS_TX = prevTx;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_TX = '1';
    expect(() => new BdsTxGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when TX off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_TX = '0';
    expect(() => new BdsTxGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and TX on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_TX = '1';
    expect(new BdsTxGuard().canActivate()).toBe(true);
  });
});
