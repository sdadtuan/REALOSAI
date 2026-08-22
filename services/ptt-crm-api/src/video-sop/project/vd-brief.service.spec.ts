import { assertBriefComplete, VdBriefService } from './vd-brief.service';
import type { VdProjectRepository, VdProjectRow } from '../video-sop.types';

const completeBody = {
  objective: 'tăng nhận biết',
  audience: 'khách hàng phổ thông A',
  offer: 'gói retainer content',
  duration_sec: 30,
  platform: 'reels',
  tone: 'rõ ràng',
  constraints: 'không mặt người',
  insight_ids: [] as number[],
};

describe('assertBriefComplete', () => {
  it('fails when objective short', () => {
    expect(() => assertBriefComplete({
      objective: 'hi', audience: 'khách hàng phổ thông A', offer: 'gói retainer content',
      duration_sec: 30, platform: 'reels', tone: 'rõ ràng', constraints: 'không mặt người',
      insight_ids: [],
    })).toThrow(/brief_incomplete/);
  });
  it('passes with eight groups', () => {
    expect(() => assertBriefComplete({
      objective: 'tăng nhận biết', audience: 'khách hàng phổ thông A', offer: 'gói retainer content',
      duration_sec: 30, platform: 'reels', tone: 'rõ ràng', constraints: 'không mặt người',
      insight_ids: [],
    })).not.toThrow();
  });

  it('fails when tone short', () => {
    expect(() => assertBriefComplete({ ...completeBody, tone: 'ab' })).toThrow(/brief_incomplete/);
  });

  it('fails when duration_sec out of range', () => {
    expect(() => assertBriefComplete({ ...completeBody, duration_sec: 14 })).toThrow(/brief_incomplete/);
    expect(() => assertBriefComplete({ ...completeBody, duration_sec: 61 })).toThrow(/brief_incomplete/);
  });

  it('fails when platform invalid', () => {
    expect(() => assertBriefComplete({ ...completeBody, platform: 'tiktok' })).toThrow(/brief_incomplete/);
  });

  it('fails when insight_ids missing or not number array', () => {
    const { insight_ids: _omit, ...rest } = completeBody;
    expect(() => assertBriefComplete(rest)).toThrow(/brief_incomplete/);
    expect(() => assertBriefComplete({ ...completeBody, insight_ids: ['1'] })).toThrow(/brief_incomplete/);
  });
});

function project(overrides: Partial<VdProjectRow> = {}): VdProjectRow {
  return {
    id: 7,
    lifecycle_id: 3,
    client_id: null,
    cmkt_item_id: 12,
    title: 'Chiến dịch',
    stage: 'brief_draft',
    status: 'active',
    created_by: 'a@b.c',
    created_at: '2026-08-20T00:00:00.000Z',
    updated_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

function makeSvc(opts: {
  enabled?: boolean;
  project?: VdProjectRow | null;
  brief?: Record<string, unknown> | null;
  insightsError?: boolean;
}) {
  const repo: jest.Mocked<Pick<VdProjectRepository, 'getById' | 'getBrief' | 'upsertBrief' | 'updateStage'> & {
    listApprovedInsights: () => Promise<Array<{ id: number; title: string }>>;
  }> = {
    getById: jest.fn().mockResolvedValue(opts.project === undefined ? project() : opts.project),
    getBrief: jest.fn().mockResolvedValue(opts.brief === undefined ? {} : opts.brief),
    upsertBrief: jest.fn().mockResolvedValue(undefined),
    updateStage: jest.fn().mockResolvedValue(undefined),
    listApprovedInsights: opts.insightsError
      ? jest.fn().mockRejectedValue(new Error('relation missing'))
      : jest.fn().mockResolvedValue([{ id: 1, title: 'Insight A' }]),
  };
  const config = { contentMarketingVideoCinematicEnabled: opts.enabled ?? true };
  const svc = new VdBriefService(config as never, repo as never);
  return Object.assign(svc, { repo });
}

describe('VdBriefService', () => {
  it('get returns project_id body_json stage', async () => {
    const svc = makeSvc({ brief: { objective: 'draft' } });
    await expect(svc.get(7)).resolves.toEqual({
      project_id: 7,
      body_json: { objective: 'draft' },
      stage: 'brief_draft',
    });
  });

  it('save upserts incomplete draft without changing stage', async () => {
    const svc = makeSvc({ brief: {} });
    const row = await svc.save(7, { objective: 'hi', insight_ids: [] });
    expect(svc.repo.upsertBrief).toHaveBeenCalledWith(7, expect.objectContaining({ objective: 'hi' }));
    expect(svc.repo.updateStage).not.toHaveBeenCalled();
    expect(row.stage).toBe('brief_draft');
  });

  it('save rejects when cinematic flag off', async () => {
    const svc = makeSvc({ enabled: false });
    await expect(svc.save(7, completeBody)).rejects.toThrow(/cmkt_cinematic_disabled/);
  });

  it('markReady asserts complete then sets brief_ready', async () => {
    const svc = makeSvc({ brief: completeBody });
    const row = await svc.markReady(7);
    expect(svc.repo.updateStage).toHaveBeenCalledWith(7, 'brief_ready');
    expect(row.stage).toBe('brief_ready');
  });

  it('markReady throws brief_incomplete', async () => {
    const svc = makeSvc({ brief: { ...completeBody, objective: 'hi' } });
    await expect(svc.markReady(7)).rejects.toThrow(/brief_incomplete/);
    expect(svc.repo.updateStage).not.toHaveBeenCalled();
  });

  it('markReady throws stage_guard from keyframing', async () => {
    const svc = makeSvc({ project: project({ stage: 'keyframing' }), brief: completeBody });
    await expect(svc.markReady(7)).rejects.toThrow(/stage_guard/);
  });

  it('markReady rejects when cinematic flag off', async () => {
    const svc = makeSvc({ enabled: false, brief: completeBody });
    await expect(svc.markReady(7)).rejects.toThrow(/cmkt_cinematic_disabled/);
  });

  it('get throws vd_project_not_found', async () => {
    const svc = makeSvc({ project: null });
    await expect(svc.get(99)).rejects.toThrow(/vd_project_not_found/);
  });

  it('listInsights returns empty items when query fails', async () => {
    const svc = makeSvc({ insightsError: true });
    await expect(svc.listInsights()).resolves.toEqual({ items: [] });
  });
});
