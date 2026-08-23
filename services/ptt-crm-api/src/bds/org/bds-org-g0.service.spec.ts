import { BadRequestException } from '@nestjs/common';
import { BdsOrgG0Service, requiredRolesError } from './bds-org-g0.service';

describe('BdsOrgG0Service', () => {
  it('lists missing five A when roster incomplete', async () => {
    const svc = new BdsOrgG0Service({
      listUsers: jest.fn().mockResolvedValue([
        { position_code: 'pm_du_an' },
        { position_code: 'gdkd' },
      ]),
    } as never);
    const out = await svc.getG0Status();
    expect(out.ready).toBe(false);
    expect(out.missing_position_codes).toEqual(['truong_pc', 'truong_collection', 'truong_sp']);
  });

  it('ready when all five A assigned', async () => {
    const svc = new BdsOrgG0Service({
      listUsers: jest.fn().mockResolvedValue([
        { position_code: 'pm_du_an' },
        { position_code: 'gdkd' },
        { position_code: 'truong_pc' },
        { position_code: 'truong_collection' },
        { position_code: 'truong_sp' },
      ]),
    } as never);
    const out = await svc.getG0Status();
    expect(out.ready).toBe(true);
    expect(out.missing_position_codes).toEqual([]);
  });

  it('assertG0Ready throws required_roles', async () => {
    const svc = new BdsOrgG0Service({
      listUsers: jest.fn().mockResolvedValue([{ position_code: 'tvv_inhouse' }]),
    } as never);
    await expect(svc.assertG0Ready()).rejects.toMatchObject({
      response: requiredRolesError([
        'pm_du_an',
        'gdkd',
        'truong_pc',
        'truong_collection',
        'truong_sp',
      ]),
    });
  });

  it('dedupes assigned position codes', async () => {
    const svc = new BdsOrgG0Service({
      listUsers: jest.fn().mockResolvedValue([
        { position_code: 'pm_du_an' },
        { position_code: 'pm_du_an' },
        { position_code: 'gdkd' },
        { position_code: 'truong_pc' },
        { position_code: 'truong_collection' },
        { position_code: 'truong_sp' },
      ]),
    } as never);
    await expect(svc.getG0Status()).resolves.toMatchObject({ ready: true });
  });
});

describe('requiredRolesError', () => {
  it('uses UX code required_roles', () => {
    expect(requiredRolesError(['gdkd'])).toEqual({ error: 'required_roles', missing: ['gdkd'] });
  });
});
