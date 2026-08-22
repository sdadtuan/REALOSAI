import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BdsInventoryService } from './bds-inventory.service';

describe('BdsInventoryService', () => {
  const unit = {
    id: 9,
    project_id: 1,
    status: 'available',
    row_version: 1,
    pool: 'inhouse',
    unit_code: 'A-1201',
    notes: '',
    tenant_id: undefined as string | undefined,
  };

  function make(overrides?: Partial<typeof unit>) {
    const repo = {
      getById: jest.fn().mockResolvedValue({ ...unit, ...overrides }),
      transitionOptimistic: jest.fn().mockResolvedValue(true),
      setLockNoteIfEmpty: jest.fn().mockResolvedValue(undefined),
      updatePool: jest.fn().mockResolvedValue(true),
      findByUnitCode: jest.fn(),
      insertImported: jest.fn(),
      nextId: jest.fn(),
      resolveProjectTenantId: jest.fn(),
      listByProject: jest.fn(),
    };
    const svc = new BdsInventoryService(repo as never);
    return { svc, repo };
  }

  it('lock available → locked and bumps via repo', async () => {
    const { svc, repo } = make();
    repo.getById.mockResolvedValueOnce(unit).mockResolvedValueOnce({ ...unit, status: 'locked', row_version: 2 });
    const out = await svc.lock(9, 1, 'bảo trì thang');
    expect(repo.transitionOptimistic).toHaveBeenCalledWith(9, 1, 'locked');
    expect(out.status).toBe('locked');
  });

  it('409 when row_version mismatches (BR-BDS-14)', async () => {
    const { svc, repo } = make();
    repo.transitionOptimistic.mockResolvedValue(false);
    await expect(svc.lock(9, 99, 'bảo trì thang')).rejects.toBeInstanceOf(ConflictException);
    try {
      await svc.lock(9, 99, 'bảo trì thang');
    } catch (e) {
      expect((e as ConflictException).getResponse()).toEqual({ error: 'unit_locked' });
    }
    expect(repo.setLockNoteIfEmpty).not.toHaveBeenCalled();
  });

  it('lock writes [lock] note when notes empty', async () => {
    const { svc, repo } = make();
    repo.getById.mockResolvedValueOnce({ ...unit, notes: '' }).mockResolvedValueOnce({
      ...unit,
      status: 'locked',
      row_version: 2,
      notes: '',
    });
    await svc.lock(9, 1, '  bảo trì thang  ');
    expect(repo.setLockNoteIfEmpty).toHaveBeenCalledWith(9, '[lock] bảo trì thang');
  });

  it('404 when unit missing', async () => {
    const { svc, repo } = make();
    repo.getById.mockResolvedValue(null);
    await expect(svc.lock(9, 1, 'abc')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('cancel booked → available (BDS-14)', async () => {
    const booked = { ...unit, status: 'booked' };
    const { svc, repo } = make(booked);
    repo.getById.mockResolvedValueOnce(booked).mockResolvedValueOnce({ ...booked, status: 'available', row_version: 2 });
    const out = await svc.transition(9, 'cancel', 1);
    expect(repo.transitionOptimistic).toHaveBeenCalledWith(9, 1, 'available');
    expect(out.status).toBe('available');
  });

  it('rejects lock reason shorter than 3', async () => {
    const { svc } = make();
    await expect(svc.lock(9, 1, 'ab')).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.lock(9, 1, 'ab');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'reason' });
    }
  });

  it('400 when lock row_version is not finite', async () => {
    const { svc, repo } = make();
    await expect(svc.lock(9, Number(undefined), 'bảo trì thang')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await svc.lock(9, Number('x'), 'bảo trì thang');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'row_version' });
    }
    expect(repo.transitionOptimistic).not.toHaveBeenCalled();
  });

  it('400 when unlock/setPool row_version is not finite', async () => {
    const { svc } = make();
    await expect(svc.unlock(9, Number.NaN)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setPool(9, 'inhouse', Number.POSITIVE_INFINITY)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('404 lock when header tenant mismatches unit tenant_id', async () => {
    const { svc, repo } = make({ tenant_id: 't-other' });
    await expect(svc.lock(9, 1, 'bảo trì thang', 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.transitionOptimistic).not.toHaveBeenCalled();
  });

  it('lock proceeds when unit tenant_id matches header', async () => {
    const { svc, repo } = make({ tenant_id: 't1' });
    repo.getById.mockResolvedValueOnce({ ...unit, tenant_id: 't1' }).mockResolvedValueOnce({
      ...unit,
      tenant_id: 't1',
      status: 'locked',
      row_version: 2,
    });
    const out = await svc.lock(9, 1, 'bảo trì thang', 't1');
    expect(out.status).toBe('locked');
  });

  it('lock proceeds when unit tenant_id is unset even if header present', async () => {
    const { svc, repo } = make();
    await svc.lock(9, 1, 'bảo trì thang', 't1');
    expect(repo.transitionOptimistic).toHaveBeenCalledWith(9, 1, 'locked');
  });
});

describe('importCsv', () => {
  const baseRepo = () => ({
    getById: jest.fn(),
    transitionOptimistic: jest.fn(),
    updatePool: jest.fn(),
    findByUnitCode: jest.fn().mockResolvedValue(null),
    resolveProjectTenantId: jest.fn().mockResolvedValue('t1'),
    nextId: jest.fn().mockResolvedValueOnce(101).mockResolvedValueOnce(102),
    insertImported: jest.fn(),
    listByProject: jest.fn().mockResolvedValue([]),
  });

  it('BDS-16: duplicate in file → 409 and no insert', async () => {
    const repo = baseRepo();
    const svc = new BdsInventoryService(repo as never);
    await expect(
      svc.importCsv(1, 'unit_code\nA-01\nA-01\n'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.insertImported).not.toHaveBeenCalled();
  });

  it('BDS-07: existing sold is skipped, other row imports', async () => {
    const repo = baseRepo();
    repo.findByUnitCode.mockImplementation(async (_pid: number, code: string) => {
      if (code === 'SOLD-1') return { unit_code: 'SOLD-1', status: 'sold' };
      return null;
    });
    const svc = new BdsInventoryService(repo as never);
    const out = await svc.importCsv(1, 'unit_code\nSOLD-1\nNEW-1\n');
    expect(out.skipped_sold).toEqual([{ unit_code: 'SOLD-1', reason: 'sold' }]);
    expect(out.imported).toBe(1);
    expect(repo.insertImported).toHaveBeenCalledTimes(1);
  });

  it('BDS-16: existing available same code → 409 no insert', async () => {
    const repo = baseRepo();
    repo.findByUnitCode.mockResolvedValue({ unit_code: 'A-01', status: 'available' });
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.importCsv(1, 'unit_code\nA-01\n')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.insertImported).not.toHaveBeenCalled();
  });

  it('400 when CSV header missing unit_code', async () => {
    const repo = baseRepo();
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.importCsv(1, 'tower,floor\nA,1\n')).rejects.toBeInstanceOf(BadRequestException);
    try {
      await svc.importCsv(1, 'tower,floor\nA,1\n');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'unit_code' });
    }
    expect(repo.insertImported).not.toHaveBeenCalled();
  });

  it('404 import when header tenant mismatches project tenant', async () => {
    const repo = baseRepo();
    repo.resolveProjectTenantId.mockResolvedValue('t-other');
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.importCsv(1, 'unit_code\nA-01\n', 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.insertImported).not.toHaveBeenCalled();
  });

  it('404 import when project tenant is null and header present', async () => {
    const repo = baseRepo();
    repo.resolveProjectTenantId.mockResolvedValue(null);
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.importCsv(1, 'unit_code\nA-01\n', 't1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('stack', () => {
  it('stack groups tower then floor', async () => {
    const repo = {
      getById: jest.fn(),
      transitionOptimistic: jest.fn(),
      updatePool: jest.fn(),
      listByProject: jest.fn().mockResolvedValue([
        { id: 1, unit_code: 'A-1201', tower: 'A', floor: '12', status: 'available', pool: 'inhouse', row_version: 1 },
        { id: 2, unit_code: 'A-1202', tower: 'A', floor: '12', status: 'locked', pool: 'channel', row_version: 3 },
        { id: 3, unit_code: 'B-0501', tower: 'B', floor: '5', status: 'available', pool: 'inhouse', row_version: 1 },
      ]),
    };
    const svc = new BdsInventoryService(repo as never);
    const out = await svc.stack(7);
    expect(out.project_id).toBe(7);
    expect(out.towers.map((t) => t.tower)).toEqual(['A', 'B']);
    expect(out.towers[0].floors[0].floor).toBe('12');
    expect(out.towers[0].floors[0].units).toHaveLength(2);
  });

  it('404 listUnits/stack when header tenant mismatches or project tenant null', async () => {
    const repo = {
      getById: jest.fn(),
      transitionOptimistic: jest.fn(),
      updatePool: jest.fn(),
      resolveProjectTenantId: jest.fn().mockResolvedValue('t-other'),
      listByProject: jest.fn().mockResolvedValue([]),
    };
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.listUnits(7, 't1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.stack(7, 't1')).rejects.toBeInstanceOf(NotFoundException);
    repo.resolveProjectTenantId.mockResolvedValue(null);
    await expect(svc.listUnits(7, 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.listByProject).not.toHaveBeenCalled();
  });

  it('listUnits without tenant header skips filter', async () => {
    const repo = {
      getById: jest.fn(),
      resolveProjectTenantId: jest.fn(),
      listByProject: jest.fn().mockResolvedValue([]),
    };
    const svc = new BdsInventoryService(repo as never);
    await expect(svc.listUnits(7)).resolves.toEqual({ units: [] });
    expect(repo.resolveProjectTenantId).not.toHaveBeenCalled();
  });
});
