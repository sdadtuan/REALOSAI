import { NotFoundException } from '@nestjs/common';
import { BdsUiGuard } from './bds-ui.guard';

describe('BdsUiGuard', () => {
  const prevPack = process.env.PTT_BDS_PACK;
  const prevUi = process.env.PTT_BDS_UI;

  afterEach(() => {
    if (prevPack === undefined) delete process.env.PTT_BDS_PACK;
    else process.env.PTT_BDS_PACK = prevPack;
    if (prevUi === undefined) delete process.env.PTT_BDS_UI;
    else process.env.PTT_BDS_UI = prevUi;
  });

  it('404 when PACK off', () => {
    delete process.env.PTT_BDS_PACK;
    process.env.PTT_BDS_UI = '1';
    const guard = new BdsUiGuard();
    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('404 when UI off', () => {
    process.env.PTT_BDS_PACK = '1';
    delete process.env.PTT_BDS_UI;
    const guard = new BdsUiGuard();
    expect(() => guard.canActivate()).toThrow(NotFoundException);
  });

  it('allows when PACK and UI on', () => {
    process.env.PTT_BDS_PACK = '1';
    process.env.PTT_BDS_UI = '1';
    const guard = new BdsUiGuard();
    expect(guard.canActivate()).toBe(true);
  });
});
