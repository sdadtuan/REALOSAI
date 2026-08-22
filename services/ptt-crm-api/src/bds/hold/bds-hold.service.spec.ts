import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { BdsHoldService } from './bds-hold.service';

describe('BdsHoldService', () => {
  const prevProjectOs = process.env.PTT_BDS_PROJECT_OS;
  afterEach(() => {
    if (prevProjectOs === undefined) delete process.env.PTT_BDS_PROJECT_OS;
    else process.env.PTT_BDS_PROJECT_OS = prevProjectOs;
  });

  function make() {
    const inventory = {
      getOrThrow: jest.fn().mockResolvedValue({
        id: 9, project_id: 1, status: 'available', row_version: 1, tenant_id: null,
      }),
      listUnits: jest.fn().mockResolvedValue({ units: [] }),
      transition: jest.fn().mockResolvedValue({ id: 9, status: 'hold', row_version: 2 }),
    };
    const products = {
      setHoldPointers: jest.fn(),
      resolveProjectTenantId: jest.fn().mockResolvedValue(null),
    };
    const repo = {
      getProjectHoldContext: jest.fn().mockResolvedValue({
        status: 'planning', current_phase_id: null, settings_json: {},
      }),
      insertHold: jest.fn().mockImplementation(async (row) => ({ id: 'h1', ...row })),
      getIdempotency: jest.fn().mockResolvedValue(null),
      putIdempotency: jest.fn(),
      setHoldStatus: jest.fn().mockImplementation(async (id, status, _reason, extras) => ({
        id,
        status,
        expires_at: extras?.expires_at ?? null,
        approved_by: extras?.approved_by ?? '',
        approved_at: extras?.approved_at ?? null,
      })),
      setHoldStatusIf: jest.fn().mockImplementation(async (id, status, extras) => ({
        id,
        status,
        expires_at: extras?.expires_at ?? null,
        approved_by: extras?.approved_by ?? '',
        approved_at: extras?.approved_at ?? null,
      })),
      getHold: jest.fn().mockResolvedValue(null),
      listByProject: jest.fn().mockResolvedValue([]),
      listActiveDue: jest.fn().mockResolvedValue([]),
    };
    const projectOs = {
      listPhases: jest.fn().mockResolvedValue([{ status: 'active', open_to_channel: false }]),
    };
    const svc = new BdsHoldService(
      inventory as never,
      products as never,
      repo as never,
      projectOs as never,
    );
    return { svc, inventory, products, repo, projectOs };
  }

  it('BDS-06 inhouse create → active + transition hold + pointers', async () => {
    const { svc, inventory, products } = make();
    const out = await svc.create(9, { lead_id: 44, row_version: 1 }, {});
    expect(out.status).toBe('active');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'hold', 1, undefined);
    expect(products.setHoldPointers).toHaveBeenCalledWith(9, expect.objectContaining({
      hold_id: 'h1', hold_lead_id: 44,
    }));
  });

  it('BDS-02 second create when unit already hold → 409 unit_locked', async () => {
    const { svc, inventory } = make();
    inventory.getOrThrow.mockResolvedValue({ id: 9, project_id: 1, status: 'hold', row_version: 2 });
    try {
      await svc.create(9, { lead_id: 1, row_version: 2 }, {});
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toEqual({ error: 'unit_locked' });
    }
  });

  it('BDS-02 transitionOptimistic miss → 409 and cancels inserted hold', async () => {
    const { svc, inventory, repo } = make();
    inventory.transition.mockRejectedValue(new ConflictException({ error: 'unit_locked' }));
    await expect(svc.create(9, { lead_id: 1, row_version: 1 }, {})).rejects.toBeInstanceOf(ConflictException);
    expect(repo.setHoldStatus).toHaveBeenCalledWith('h1', 'cancelled', expect.anything());
  });

  it('idempotent replay returns first body', async () => {
    const { svc, repo, inventory } = make();
    repo.getIdempotency.mockResolvedValue({
      created_at: new Date(),
      response_json: { id: 'old', status: 'active' },
    });
    const out = await svc.create(9, { lead_id: 1, row_version: 1 }, { idempotencyKey: 'k1' });
    expect(out.id).toBe('old');
    expect(repo.getIdempotency).toHaveBeenCalledWith('POST /units/9/holds', 'k1');
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('rejects non-positive lead_id', async () => {
    const { svc } = make();
    try {
      await svc.create(9, { lead_id: 0, row_version: 1 }, {});
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'lead_id' });
    }
  });

  it('rejects non-finite row_version', async () => {
    const { svc } = make();
    try {
      await svc.create(9, { lead_id: 1, row_version: Number.NaN }, {});
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'row_version' });
    }
  });

  it('BDS-02 unique open hold (23505) → 409 unit_locked', async () => {
    const { svc, repo } = make();
    repo.insertHold.mockRejectedValue({ code: '23505' });
    try {
      await svc.create(9, { lead_id: 1, row_version: 1 }, {});
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toEqual({ error: 'unit_locked' });
    }
  });

  it('insertHold 23505 + existing idempotency → replay body', async () => {
    const { svc, repo } = make();
    repo.insertHold.mockRejectedValue({ code: '23505' });
    repo.getIdempotency
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        created_at: new Date('2020-01-01T00:00:00Z'),
        response_json: { id: 'prior', status: 'active' },
      });
    const out = await svc.create(9, { lead_id: 1, row_version: 1 }, { idempotencyKey: 'k1' });
    expect(out.id).toBe('prior');
    expect(repo.getIdempotency).toHaveBeenCalledWith('POST /units/9/holds', 'k1');
  });

  it('inhouse when autoApprove false → pending, no unit transition', async () => {
    const { svc, inventory, products, repo } = make();
    repo.getProjectHoldContext.mockResolvedValue({
      status: 'planning',
      current_phase_id: null,
      settings_json: { auto_approve_internal_hold: false },
    });
    const out = await svc.create(9, { lead_id: 2, row_version: 1 }, {});
    expect(out.status).toBe('pending');
    expect(out.expires_at).toBeNull();
    expect(inventory.transition).not.toHaveBeenCalled();
    expect(products.setHoldPointers).not.toHaveBeenCalled();
  });

  it('BDS-05 channel create → pending, no unit transition', async () => {
    const { svc, inventory, products } = make();
    const out = await svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'ag-1' }, {});
    expect(out.status).toBe('pending');
    expect(inventory.transition).not.toHaveBeenCalled();
    expect(products.setHoldPointers).not.toHaveBeenCalled();
  });

  it('channel + PROJECT_OS without open_to_channel phase → 400 phase_closed', async () => {
    process.env.PTT_BDS_PROJECT_OS = '1';
    const { svc, projectOs } = make();
    projectOs.listPhases.mockResolvedValue([{ status: 'active', open_to_channel: false }]);
    try {
      await svc.create(9, { lead_id: 2, row_version: 1, channel_partner_id: 'ag-1' }, {});
      throw new Error('expected');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'phase_closed' });
    }
  });

  it('approve pending → active + hold transition', async () => {
    const { svc, repo, inventory } = make();
    repo.getHold.mockResolvedValue({
      id: 'h2', product_id: 9, project_id: 1, status: 'pending', lead_id: 2,
    });
    const out = await svc.approve('h2', 'gdkd');
    expect(out.status).toBe('active');
    expect(inventory.transition).toHaveBeenCalled();
  });

  it('reject pending does not transition unit', async () => {
    const { svc, repo, inventory } = make();
    repo.getHold.mockResolvedValue({ id: 'h2', product_id: 9, status: 'pending' });
    await svc.reject('h2', 'het hang');
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('reject reason shorter than 3 after trim → 400 reason', async () => {
    const { svc, repo } = make();
    repo.getHold.mockResolvedValue({ id: 'h2', product_id: 9, status: 'pending' });
    try {
      await svc.reject('h2', '  ab  ');
      throw new Error('expected');
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'reason' });
    }
  });

  it('approve missing hold → 404', async () => {
    const { svc } = make();
    await expect(svc.approve('missing', 'gdkd')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reject missing hold → 404', async () => {
    const { svc } = make();
    await expect(svc.reject('missing', 'het hang')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('approve setHoldStatusIf miss → 409 hold_closed, no transition', async () => {
    const { svc, repo, inventory } = make();
    repo.getHold.mockResolvedValue({
      id: 'h2', product_id: 9, project_id: 1, status: 'pending', lead_id: 2,
    });
    repo.setHoldStatusIf.mockResolvedValue(null);
    try {
      await svc.approve('h2', 'gdkd');
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toEqual({ error: 'hold_closed' });
    }
    expect(inventory.transition).not.toHaveBeenCalled();
  });

  it('cancel reason shorter than 3 after trim → 400 reason', async () => {
    const { svc } = make();
    try {
      await svc.cancel('h1', '  ab  ');
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'reason' });
    }
  });

  it('cancel pending → cancelled, no unit transition', async () => {
    const { svc, repo, inventory, products } = make();
    repo.getHold.mockResolvedValue({ id: 'h2', product_id: 9, status: 'pending' });
    const out = await svc.cancel('h2', 'khach bo');
    expect(out.status).toBe('cancelled');
    expect(repo.setHoldStatusIf).toHaveBeenCalledWith(
      'h2',
      'cancelled',
      expect.objectContaining({ reason: 'khach bo' }),
      'pending',
    );
    expect(inventory.transition).not.toHaveBeenCalled();
    expect(products.setHoldPointers).not.toHaveBeenCalled();
  });

  it('cancel active → cancelled + cancel transition + clear pointers', async () => {
    const { svc, repo, inventory, products } = make();
    repo.getHold.mockResolvedValue({ id: 'h1', product_id: 9, status: 'active' });
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'h1', row_version: 4,
    });
    const out = await svc.cancel('h1', 'khach bo');
    expect(out.status).toBe('cancelled');
    expect(inventory.transition).toHaveBeenCalledWith(9, 'cancel', 4, undefined);
    expect(products.setHoldPointers).toHaveBeenCalledWith(9, {
      hold_id: null, hold_lead_id: null, hold_at: '',
    });
    expect(repo.setHoldStatusIf).toHaveBeenCalledWith(
      'h1',
      'cancelled',
      expect.objectContaining({ reason: 'khach bo' }),
      'active',
    );
    expect(inventory.transition.mock.invocationCallOrder[0]).toBeLessThan(
      repo.setHoldStatusIf.mock.invocationCallOrder[0],
    );
  });

  it('cancel active when unit already not hold still closes hold', async () => {
    const { svc, repo, inventory, products } = make();
    repo.getHold.mockResolvedValue({ id: 'h1', product_id: 9, status: 'active' });
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'available', hold_id: null, row_version: 5,
    });
    const out = await svc.cancel('h1', 'khach bo');
    expect(out.status).toBe('cancelled');
    expect(inventory.transition).not.toHaveBeenCalled();
    expect(products.setHoldPointers).not.toHaveBeenCalled();
    expect(repo.setHoldStatusIf).toHaveBeenCalledWith(
      'h1',
      'cancelled',
      expect.objectContaining({ reason: 'khach bo' }),
      'active',
    );
  });

  it('cancel active transition fail → do not mark cancelled', async () => {
    const { svc, repo, inventory } = make();
    repo.getHold.mockResolvedValue({ id: 'h1', product_id: 9, status: 'active' });
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'h1', row_version: 4,
    });
    inventory.transition.mockRejectedValue(new ConflictException({ error: 'unit_locked' }));
    await expect(svc.cancel('h1', 'khach bo')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.setHoldStatusIf).not.toHaveBeenCalled();
  });

  it('cancel expired|rejected|converted|cancelled → 409 hold_closed', async () => {
    const { svc, repo } = make();
    for (const status of ['expired', 'rejected', 'converted', 'cancelled'] as const) {
      repo.getHold.mockResolvedValue({ id: 'h3', product_id: 9, status });
      try {
        await svc.cancel('h3', 'khach bo');
        throw new Error(`expected ${status}`);
      } catch (e) {
        expect(e).toBeInstanceOf(ConflictException);
        expect((e as ConflictException).getResponse()).toEqual({ error: 'hold_closed' });
      }
    }
  });

  it('cancel setHoldStatusIf miss → 409 hold_closed', async () => {
    const { svc, repo, inventory } = make();
    repo.getHold.mockResolvedValue({ id: 'h1', product_id: 9, status: 'active' });
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'h1', row_version: 4,
    });
    repo.setHoldStatusIf.mockResolvedValue(null);
    try {
      await svc.cancel('h1', 'khach bo');
      throw new Error('expected');
    } catch (e) {
      expect(e).toBeInstanceOf(ConflictException);
      expect((e as ConflictException).getResponse()).toEqual({ error: 'hold_closed' });
    }
    expect(inventory.transition).toHaveBeenCalledWith(9, 'cancel', 4, undefined);
  });

  it('get returns hold after tenant check', async () => {
    const { svc, repo } = make();
    repo.getHold.mockResolvedValue({ id: 'h1', tenant_id: 't1', status: 'active' });
    await expect(svc.get('h1', 't1')).resolves.toEqual(
      expect.objectContaining({ id: 'h1', status: 'active' }),
    );
  });

  it('get 404 when tenant mismatches', async () => {
    const { svc, repo } = make();
    repo.getHold.mockResolvedValue({ id: 'h1', tenant_id: 't1', status: 'active' });
    await expect(svc.get('h1', 't-other')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listByProject asserts project via inventory then lists holds', async () => {
    const { svc, inventory, repo } = make();
    repo.listByProject.mockResolvedValue([{ id: 'h1', project_id: 7 }]);
    await expect(svc.listByProject(7, 't1')).resolves.toEqual([{ id: 'h1', project_id: 7 }]);
    expect(inventory.listUnits).toHaveBeenCalledWith(7, 't1');
    expect(repo.listByProject).toHaveBeenCalledWith(7);
  });

  it('BDS-03 expireDue active past expires_at → expired + ttl transition', async () => {
    const { svc, repo, inventory, products } = make();
    repo.listActiveDue.mockResolvedValue([
      { id: 'h1', product_id: 9, status: 'active' },
    ]);
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'h1', row_version: 3,
    });
    const n = await svc.expireDue(new Date('2026-08-22T12:00:00Z'));
    expect(n).toBe(1);
    expect(inventory.transition).toHaveBeenCalledWith(9, 'ttl', 3, undefined);
    expect(products.setHoldPointers).toHaveBeenCalledWith(9, {
      hold_id: null, hold_lead_id: null, hold_at: '',
    });
    expect(repo.setHoldStatusIf).toHaveBeenCalledWith('h1', 'expired', {}, 'active');
    expect(inventory.transition.mock.invocationCallOrder[0]).toBeLessThan(
      repo.setHoldStatusIf.mock.invocationCallOrder[0],
    );
  });

  it('expireDue skips ttl when unit hold_id does not match', async () => {
    const { svc, repo, inventory, products } = make();
    repo.listActiveDue.mockResolvedValue([
      { id: 'h1', product_id: 9, status: 'active' },
    ]);
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'other', row_version: 3,
    });
    const n = await svc.expireDue(new Date('2026-08-22T12:00:00Z'));
    expect(n).toBe(1);
    expect(inventory.transition).not.toHaveBeenCalled();
    expect(products.setHoldPointers).not.toHaveBeenCalled();
    expect(repo.setHoldStatusIf).toHaveBeenCalledWith('h1', 'expired', {}, 'active');
  });

  it('expireDue continues after per-row error', async () => {
    const { svc, repo, inventory } = make();
    repo.listActiveDue.mockResolvedValue([
      { id: 'bad', product_id: 8, status: 'active' },
      { id: 'h1', product_id: 9, status: 'active' },
    ]);
    inventory.getOrThrow.mockImplementation(async (id: number) => {
      if (id === 8) throw new Error('row fail');
      return { id: 9, status: 'hold', hold_id: 'h1', row_version: 3 };
    });
    const n = await svc.expireDue(new Date('2026-08-22T12:00:00Z'));
    expect(n).toBe(1);
    expect(inventory.transition).toHaveBeenCalledWith(9, 'ttl', 3, undefined);
    expect(repo.setHoldStatusIf).toHaveBeenCalledWith('h1', 'expired', {}, 'active');
  });

  it('expireDue transition fail leaves hold active for retry', async () => {
    const { svc, repo, inventory } = make();
    repo.listActiveDue.mockResolvedValue([
      { id: 'h1', product_id: 9, status: 'active' },
    ]);
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'h1', row_version: 3,
    });
    inventory.transition.mockRejectedValue(new Error('ttl fail'));
    const n = await svc.expireDue(new Date('2026-08-22T12:00:00Z'));
    expect(n).toBe(0);
    expect(repo.setHoldStatusIf).not.toHaveBeenCalled();
  });

  it('expireDue setHoldStatusIf miss → skip count', async () => {
    const { svc, repo, inventory } = make();
    repo.listActiveDue.mockResolvedValue([
      { id: 'h1', product_id: 9, status: 'active' },
    ]);
    inventory.getOrThrow.mockResolvedValue({
      id: 9, status: 'hold', hold_id: 'h1', row_version: 3,
    });
    repo.setHoldStatusIf.mockResolvedValue(null);
    const n = await svc.expireDue(new Date('2026-08-22T12:00:00Z'));
    expect(n).toBe(0);
    expect(inventory.transition).toHaveBeenCalledWith(9, 'ttl', 3, undefined);
  });

  it('insertHold stamps tenant from unit, not opts.tenantId', async () => {
    const { svc, repo, inventory } = make();
    inventory.getOrThrow.mockResolvedValue({
      id: 9, project_id: 1, status: 'available', row_version: 1, tenant_id: 'unit-t',
    });
    await svc.create(9, { lead_id: 1, row_version: 1 }, { tenantId: 'header-t' });
    expect(repo.insertHold).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'unit-t',
    }));
  });

  it('insertHold falls back to project tenant when unit has none', async () => {
    const { svc, repo, products } = make();
    products.resolveProjectTenantId.mockResolvedValue('proj-t');
    await svc.create(9, { lead_id: 1, row_version: 1 }, { tenantId: 'header-t' });
    expect(products.resolveProjectTenantId).toHaveBeenCalledWith(1);
    expect(repo.insertHold).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'proj-t',
    }));
  });

  it('inhouse create sets expires_at to about now+30m', async () => {
    const { svc } = make();
    const now = new Date();
    const out = await svc.create(9, { lead_id: 44, row_version: 1 }, { now });
    expect(out.expires_at).toBeTruthy();
    expect(out.expires_at!.getTime()).toBeGreaterThan(now.getTime() + 29 * 60 * 1000);
  });
});
