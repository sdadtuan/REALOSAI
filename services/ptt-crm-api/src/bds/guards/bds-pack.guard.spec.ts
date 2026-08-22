import { NotFoundException } from '@nestjs/common';
import { BdsPackGuard } from './bds-pack.guard';

describe('BdsPackGuard', () => {
  const prev = process.env.PTT_BDS_PACK;
  afterEach(() => {
    process.env.PTT_BDS_PACK = prev;
  });

  it('throws NotFoundException when PACK is off (BDS-01)', () => {
    process.env.PTT_BDS_PACK = '0';
    expect(() => new BdsPackGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK is on', () => {
    process.env.PTT_BDS_PACK = '1';
    expect(new BdsPackGuard().canActivate()).toBe(true);
  });
});
