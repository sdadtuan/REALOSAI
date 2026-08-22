import { NotFoundException } from '@nestjs/common';
import { BdsCollectionGuard } from './bds-collection.guard';

describe('BdsCollectionGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevCollection = process.env.PTT_BDS_COLLECTION;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevCollection === undefined) delete process.env.PTT_BDS_COLLECTION;
    else process.env.PTT_BDS_COLLECTION = prevCollection;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_COLLECTION = '1';
    expect(() => new BdsCollectionGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when COLLECTION off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_COLLECTION = '0';
    expect(() => new BdsCollectionGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and COLLECTION on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_COLLECTION = '1';
    expect(new BdsCollectionGuard().canActivate()).toBe(true);
  });
});
