import { VdProjectService } from './vd-project.service';
import type { VdProjectRepository, VdProjectRow } from '../video-sop.types';

type MakeSvcOpts = {
  enabled: boolean;
  cap: number;
  today: number;
  existing?: { id: number; cmkt_item_id?: number; stage?: string };
};

function makeSvc(opts: MakeSvcOpts) {
  const repo: jest.Mocked<VdProjectRepository> = {
    findByCmktItemId: jest.fn().mockResolvedValue((opts.existing ?? null) as VdProjectRow | null),
    countCreatedToday: jest.fn().mockResolvedValue(opts.today),
    withTransaction: jest.fn(async (fn) => fn()) as jest.Mocked<VdProjectRepository>['withTransaction'],
    insertProject: jest.fn(),
    insertBrief: jest.fn(),
    getBrief: jest.fn(),
    upsertBrief: jest.fn(),
    updateStage: jest.fn(),
    insertScript: jest.fn(),
    insertAudit: jest.fn(),
    listByLifecycle: jest.fn(),
    getById: jest.fn(),
  };
  const config = {
    contentMarketingVideoCinematicEnabled: opts.enabled,
    contentMarketingVideoCinematicDailyCap: opts.cap,
  };
  const svc = new VdProjectService(config as never, repo as never);
  return Object.assign(svc, { repo });
}

describe('VdProjectService', () => {
  it('rejects when cinematic flag off', async () => {
    const svc = makeSvc({ enabled: false, cap: 1, today: 0 });
    await expect(
      svc.createFromContentItem({
        lifecycleId: 3, itemId: 12, title: 'Chiến dịch', scriptMarkdown: 'Hook', email: 'a@b.c',
      }),
    ).rejects.toThrow(/cmkt_cinematic_disabled/);
  });

  it('rejects when daily cap reached', async () => {
    const svc = makeSvc({ enabled: true, cap: 1, today: 1 });
    await expect(
      svc.createFromContentItem({
        lifecycleId: 3, itemId: 12, title: 'Chiến dịch', scriptMarkdown: 'Hook', email: 'a@b.c',
      }),
    ).rejects.toThrow(/video_cinematic_daily_cap/);
  });

  it('returns existing project for same cmkt_item_id', async () => {
    const existing = { id: 7, cmkt_item_id: 12, stage: 'brief_draft' };
    const svc = makeSvc({ enabled: true, cap: 1, today: 0, existing });
    const row = await svc.createFromContentItem({
      lifecycleId: 3, itemId: 12, title: 'Chiến dịch', scriptMarkdown: 'Hook', email: 'a@b.c',
    });
    expect(row.id).toBe(7);
    expect(svc.repo.insertProject).not.toHaveBeenCalled();
    expect(svc.repo.countCreatedToday).not.toHaveBeenCalled();
  });

  it('inserts project brief script and audit when cap allows', async () => {
    const created = { id: 3, cmkt_item_id: 12, stage: 'brief_draft' };
    const svc = makeSvc({ enabled: true, cap: 1, today: 0 });
    svc.repo.insertProject.mockResolvedValue(created as VdProjectRow);
    const row = await svc.createFromContentItem({
      lifecycleId: 3, itemId: 12, title: 'Chiến dịch', scriptMarkdown: 'Hook', email: 'a@b.c',
    });
    expect(row.id).toBe(3);
    expect(svc.repo.insertProject).toHaveBeenCalled();
    expect(svc.repo.insertBrief).toHaveBeenCalledWith(3, {});
    expect(svc.repo.insertScript).toHaveBeenCalledWith(3, 1, 'Hook');
    expect(svc.repo.insertAudit).toHaveBeenCalledWith(
      3,
      'a@b.c',
      'project.created',
      expect.objectContaining({ cmkt_item_id: 12, lifecycle_id: 3 }),
    );
  });

  it('returns existing project when insert hits unique cmkt_item_id', async () => {
    const existing = { id: 9, cmkt_item_id: 12, stage: 'brief_draft' };
    const svc = makeSvc({ enabled: true, cap: 1, today: 0 });
    svc.repo.findByCmktItemId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing as VdProjectRow);
    svc.repo.insertProject.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );
    const row = await svc.createFromContentItem({
      lifecycleId: 3, itemId: 12, title: 'Chiến dịch', scriptMarkdown: 'Hook', email: 'a@b.c',
    });
    expect(row.id).toBe(9);
    expect(svc.repo.countCreatedToday).toHaveBeenCalled();
    expect(svc.repo.insertBrief).not.toHaveBeenCalled();
  });
});
