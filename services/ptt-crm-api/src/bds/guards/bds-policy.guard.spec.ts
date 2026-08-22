import { NotFoundException } from '@nestjs/common';
import { BdsPolicyGuard } from './bds-policy.guard';

describe('BdsPolicyGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevPolicy = process.env.PTT_BDS_POLICY;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevPolicy === undefined) delete process.env.PTT_BDS_POLICY;
    else process.env.PTT_BDS_POLICY = prevPolicy;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_POLICY = '1';
    expect(() => new BdsPolicyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when POLICY off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_POLICY = '0';
    expect(() => new BdsPolicyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and POLICY on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_POLICY = '1';
    expect(new BdsPolicyGuard().canActivate()).toBe(true);
  });
});
