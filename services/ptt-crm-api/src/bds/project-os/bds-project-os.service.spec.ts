import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { REQUIRED_SALE_DOC_TYPES } from './bds-legal-gate.util';
import { BdsProjectOsService } from './bds-project-os.service';

function make() {
  const repo = {
    listLegalDocs: jest.fn().mockResolvedValue([]),
    upsertLegalDoc: jest.fn().mockImplementation(async (_projectId: number, doc: unknown) => doc),
    getProjectGate: jest.fn().mockResolvedValue({
      legal_gate: 'blocked',
      legal_gate_override_until: null,
      legal_gate_override_reason: '',
    }),
    setProjectGate: jest.fn().mockResolvedValue(undefined),
    getPhase: jest.fn(),
    activatePhase: jest.fn(),
    closePhase: jest.fn(),
    createTower: jest.fn(),
    createZone: jest.fn(),
    createLayout: jest.fn(),
    createPhase: jest.fn(),
    listTowers: jest.fn().mockResolvedValue([]),
    listZones: jest.fn().mockResolvedValue([]),
    listLayouts: jest.fn().mockResolvedValue([]),
    listPhases: jest.fn().mockResolvedValue([]),
    maxRevisionVersion: jest.fn().mockResolvedValue(0),
    createRevision: jest.fn(),
    approveRevision: jest.fn(),
    listRevisions: jest.fn().mockResolvedValue([]),
    latestRevisionsByKind: jest.fn().mockResolvedValue([]),
    createMilestone: jest.fn(),
    listMilestones: jest.fn().mockResolvedValue([]),
    markMilestoneReached: jest.fn(),
    resolveProjectTenantId: jest.fn(),
    getMilestone: jest.fn(),
    getRevision: jest.fn(),
  };
  const svc = new BdsProjectOsService(repo as never);
  return { svc, repo };
}

describe('BdsProjectOsService legal gate', () => {
  const validDocs = REQUIRED_SALE_DOC_TYPES.map((doc_type) => ({
    doc_type,
    status: 'valid',
    expires_on: null as string | null,
  }));

  it('upsertLegalDoc then refreshLegalGate writes crm_re_projects.legal_gate', async () => {
    const { svc, repo } = make();
    repo.listLegalDocs.mockResolvedValue(validDocs);
    await svc.upsertLegalDoc(7, { doc_type: 'gpxd', status: 'valid' });
    await svc.refreshLegalGate(7);
    expect(repo.upsertLegalDoc).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ doc_type: 'gpxd', status: 'valid' }),
    );
    expect(repo.setProjectGate).toHaveBeenCalledWith(7, 'enough_to_sell');
  });

  it('openLegalGate({ override:true, reason:\'x\' }) → 400 reason', async () => {
    const { svc, repo } = make();
    await expect(svc.openLegalGate(7, { override: true, reason: 'x' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    try {
      await svc.openLegalGate(7, { override: true, reason: 'x' });
    } catch (e) {
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate' });
    }
    expect(repo.setProjectGate).not.toHaveBeenCalled();
  });

  it('openLegalGate({ override:true, reason:\'du long hon muoi\' }) set until = now+15d + enough_to_sell', async () => {
    const { svc, repo } = make();
    const now = new Date('2026-01-01T00:00:00.000Z');
    await svc.openLegalGate(7, { override: true, reason: 'du long hon muoi' }, now);
    const until = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    expect(repo.setProjectGate).toHaveBeenCalledWith(
      7,
      'enough_to_sell',
      until,
      'du long hon muoi',
    );
  });

  it('openLegalGate persists enough_to_sell when docs already satisfy gate', async () => {
    const { svc, repo } = make();
    repo.listLegalDocs.mockResolvedValue(validDocs);
    await svc.openLegalGate(7, {}, new Date('2026-01-01T00:00:00.000Z'));
    expect(repo.setProjectGate).toHaveBeenCalledWith(7, 'enough_to_sell');
  });

  it('openLegalGate without override when blocked → 400 legal_gate', async () => {
    const { svc } = make();
    try {
      await svc.openLegalGate(7, {});
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate' });
    }
  });
});

describe('BdsProjectOsService towers zones layouts phases', () => {
  it('BDS-21 openPhase when blocked → 400 legal_gate', async () => {
    const { svc, repo } = make();
    repo.getProjectGate.mockResolvedValue({ legal_gate: 'blocked' });
    repo.getPhase.mockResolvedValue({ id: 'p1', project_id: 7, status: 'planned' });
    try {
      await svc.openPhase('p1');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate' });
    }
    expect(repo.activatePhase).not.toHaveBeenCalled();
  });

  it('openPhase recomputes lapsed override before asserting', async () => {
    const { svc, repo } = make();
    let stored = {
      legal_gate: 'enough_to_sell' as const,
      legal_gate_override_until: new Date('2020-01-01T00:00:00.000Z'),
      legal_gate_override_reason: 'old override',
    };
    repo.getPhase.mockResolvedValue({ id: 'p1', project_id: 7, status: 'planned' });
    repo.listLegalDocs.mockResolvedValue([]);
    repo.getProjectGate.mockImplementation(async () => stored);
    repo.setProjectGate.mockImplementation(async (_projectId: number, gate: string) => {
      stored = { ...stored, legal_gate: gate as typeof stored.legal_gate };
    });
    try {
      await svc.openPhase('p1');
      throw new Error('expected throw');
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).getResponse()).toEqual({ error: 'legal_gate' });
    }
    expect(repo.activatePhase).not.toHaveBeenCalled();
  });

  it('openPhase when enough_to_sell activates and sets current_phase_id', async () => {
    const { svc, repo } = make();
    repo.getProjectGate.mockResolvedValue({ legal_gate: 'enough_to_sell' });
    repo.getPhase.mockResolvedValue({ id: 'p1', project_id: 7, status: 'planned' });
    repo.activatePhase.mockResolvedValue({ id: 'p1', status: 'active' });
    const out = await svc.openPhase('p1');
    expect(repo.activatePhase).toHaveBeenCalledWith('p1', 7);
    expect(out.status).toBe('active');
  });

  it('duplicate tower code → 409', async () => {
    const { svc, repo } = make();
    repo.createTower.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );
    await expect(svc.createTower(7, { code: 'A', name: 'Tower A' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('empty tower code → 400', async () => {
    const { svc, repo } = make();
    await expect(svc.createTower(7, { code: '  ', name: 'Tower A' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repo.createTower).not.toHaveBeenCalled();
  });

  it('openPhase missing phase → 404', async () => {
    const { svc, repo } = make();
    repo.getPhase.mockResolvedValue(null);
    await expect(svc.openPhase('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.activatePhase).not.toHaveBeenCalled();
  });

  it('closePhase missing → 404', async () => {
    const { svc, repo } = make();
    repo.closePhase.mockResolvedValue(null);
    await expect(svc.closePhase('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('BdsProjectOsService revisions and milestones', () => {
  it('createRevision versions increment from 1', async () => {
    const { svc, repo } = make();
    repo.maxRevisionVersion.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    repo.createRevision
      .mockResolvedValueOnce({ id: 'r1', kind: 'business', version: 1, status: 'draft' })
      .mockResolvedValueOnce({ id: 'r2', kind: 'business', version: 2, status: 'draft' });

    const first = await svc.createRevision(7, { kind: 'business', body_json: { vision: 'x' } });
    expect(first.version).toBe(1);
    expect(repo.createRevision).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        kind: 'business',
        version: 1,
        status: 'draft',
        body_json: { vision: 'x' },
      }),
    );

    const second = await svc.createRevision(7, { kind: 'business', body_json: {} });
    expect(second.version).toBe(2);
    expect(repo.createRevision).toHaveBeenNthCalledWith(
      2,
      7,
      expect.objectContaining({ kind: 'business', version: 2, status: 'draft' }),
    );
  });

  it('approveRevision sets approved and reviewed_by', async () => {
    const { svc, repo } = make();
    repo.getRevision.mockResolvedValue({ id: 'r1', project_id: 7 });
    repo.approveRevision.mockResolvedValue({
      id: 'r1',
      status: 'approved',
      reviewed_by: 'pm',
      reviewed_at: new Date('2026-08-01T00:00:00.000Z'),
    });
    const out = await svc.approveRevision('r1', 'pm');
    expect(out.status).toBe('approved');
    expect(out.reviewed_by).toBe('pm');
    expect(repo.approveRevision).toHaveBeenCalledWith('r1', 'pm', expect.any(Date));
  });

  it('approveRevision missing → 404', async () => {
    const { svc, repo } = make();
    repo.approveRevision.mockResolvedValue(null);
    await expect(svc.approveRevision('missing', 'pm')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('latestApprovedKinds empty then after approve', async () => {
    const { svc, repo } = make();
    repo.latestRevisionsByKind.mockResolvedValue([]);
    expect(await svc.latestApprovedKinds(7)).toEqual([]);

    repo.latestRevisionsByKind.mockResolvedValue([
      { kind: 'business', status: 'approved', version: 1 },
    ]);
    expect(await svc.latestApprovedKinds(7)).toEqual(['business']);
  });

  it('newer draft excludes kind from latestApprovedKinds', async () => {
    const { svc, repo } = make();
    repo.latestRevisionsByKind.mockResolvedValue([{ kind: 'business', status: 'draft', version: 2 }]);
    expect(await svc.latestApprovedKinds(7)).toEqual([]);
  });

  it('markMilestoneReached sets reached and actual_date', async () => {
    const { svc, repo } = make();
    repo.getMilestone.mockResolvedValue({ id: 'm1', project_id: 7 });
    repo.markMilestoneReached.mockResolvedValue({
      id: 'm1',
      status: 'reached',
      actual_date: '2026-08-01',
    });
    const out = await svc.markMilestoneReached('m1', '2026-08-01');
    expect(out.status).toBe('reached');
    expect(out.actual_date).toBe('2026-08-01');
    expect(repo.markMilestoneReached).toHaveBeenCalledWith('m1', '2026-08-01');
  });

  it('listLegalDocs returns repo rows', async () => {
    const { svc, repo } = make();
    repo.listLegalDocs.mockResolvedValue([{ doc_type: 'gpxd' }]);
    await expect(svc.listLegalDocs(7)).resolves.toEqual([{ doc_type: 'gpxd' }]);
    expect(repo.listLegalDocs).toHaveBeenCalledWith(7);
    expect(repo.resolveProjectTenantId).not.toHaveBeenCalled();
  });

  it('duplicate milestone code → 409', async () => {
    const { svc, repo } = make();
    repo.createMilestone.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );
    await expect(svc.createMilestone(7, { code: 'moc_mong' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});

describe('BdsProjectOsService tenant', () => {
  it('listTowers without tenant header skips filter', async () => {
    const { svc, repo } = make();
    await expect(svc.listTowers(7)).resolves.toEqual([]);
    expect(repo.resolveProjectTenantId).not.toHaveBeenCalled();
  });

  it('404 listTowers when header tenant mismatches project tenant', async () => {
    const { svc, repo } = make();
    repo.resolveProjectTenantId.mockResolvedValue('t-other');
    await expect(svc.listTowers(7, 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.listTowers).not.toHaveBeenCalled();
  });

  it('404 listTowers when project tenant is null and header present', async () => {
    const { svc, repo } = make();
    repo.resolveProjectTenantId.mockResolvedValue(null);
    await expect(svc.listTowers(7, 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.listTowers).not.toHaveBeenCalled();
  });

  it('404 openPhase when header tenant mismatches phase project', async () => {
    const { svc, repo } = make();
    repo.getPhase.mockResolvedValue({ id: 'p1', project_id: 7, status: 'planned' });
    repo.resolveProjectTenantId.mockResolvedValue('t-other');
    await expect(svc.openPhase('p1', 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.activatePhase).not.toHaveBeenCalled();
  });

  it('404 markMilestoneReached when header tenant mismatches', async () => {
    const { svc, repo } = make();
    repo.getMilestone.mockResolvedValue({ id: 'm1', project_id: 7 });
    repo.resolveProjectTenantId.mockResolvedValue('t-other');
    await expect(svc.markMilestoneReached('m1', '2026-08-01', 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.markMilestoneReached).not.toHaveBeenCalled();
  });

  it('404 approveRevision when header tenant mismatches', async () => {
    const { svc, repo } = make();
    repo.getRevision.mockResolvedValue({ id: 'r1', project_id: 7 });
    repo.resolveProjectTenantId.mockResolvedValue('t-other');
    await expect(svc.approveRevision('r1', 'pm', 't1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.approveRevision).not.toHaveBeenCalled();
  });

  it('createTower strips body tenant_id and stamps project tenant', async () => {
    const { svc, repo } = make();
    repo.resolveProjectTenantId.mockResolvedValue('t-project');
    repo.createTower.mockResolvedValue({ id: 'tw1', code: 'A', tenant_id: 't-project' });
    await svc.createTower(7, { code: 'A', tenant_id: 'evil' });
    expect(repo.createTower).toHaveBeenCalledWith(7, expect.objectContaining({ code: 'A', tenant_id: 't-project' }));
    expect(repo.createTower.mock.calls[0][1].tenant_id).not.toBe('evil');
  });
});

