import { NotFoundException } from '@nestjs/common';
import { BdsAgencyGuard } from './bds-agency.guard';

describe('BdsAgencyGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevAgency = process.env.PTT_BDS_AGENCY;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevAgency === undefined) delete process.env.PTT_BDS_AGENCY;
    else process.env.PTT_BDS_AGENCY = prevAgency;
  });

  it('404 when PACK off', () => {
    process.env.PTT_BDS_PACK = '0';
    process.env.PTT_BDS_AGENCY = '1';
    expect(() => new BdsAgencyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('404 when AGENCY off', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_AGENCY = '0';
    expect(() => new BdsAgencyGuard().canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and AGENCY on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_AGENCY = '1';
    expect(new BdsAgencyGuard().canActivate()).toBe(true);
  });
});
