import { VdMotionService } from './vd-motion.service';

describe('VdMotionService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;
  let projects: {
    getById: jest.Mock;
    getScriptById: jest.Mock;
  };
  let shots: {
    getById: jest.Mock;
    incrementTakeFailCount: jest.Mock;
    updateStatus: jest.Mock;
  };
  let assets: {
    listKeyframesByProjectId: jest.Mock;
    getById: jest.Mock;
    listByProjectIdAndKind: jest.Mock;
  };
  let takes: {
    hasPassedDraftForShot: jest.Mock;
    insertScore: jest.Mock;
    getBudget: jest.Mock;
    listByProjectId: jest.Mock;
  };
  let dispatcher: { enqueue: jest.Mock };
  let service: VdMotionService;

  const shotRow = {
    id: 11,
    script_id: 3,
    ordinal: 1,
    status: 'keyframe_approved',
    duration_ms: 3000,
    camera: 'wide',
    action: 'walk',
    aspect: '9:16',
    take_fail_count: 0,
  };

  beforeEach(() => {
    projects = {
      getById: jest.fn().mockResolvedValue({ id: 7, stage: 'animating' }),
      getScriptById: jest.fn().mockResolvedValue({ id: 3, project_id: 7 }),
    };
    shots = {
      getById: jest.fn().mockImplementation(async () => ({ ...shotRow })),
      incrementTakeFailCount: jest.fn().mockResolvedValue(undefined),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };
    assets = {
      listKeyframesByProjectId: jest.fn().mockResolvedValue([{ id: 50, url: 'https://img/1.png' }]),
      getById: jest.fn().mockResolvedValue({
        id: 99,
        project_id: 7,
        kind: 'take',
        url: 'https://take/1',
        storage_key: '',
        sha256: 'abc',
        duration_ms: 3000,
      }),
      listByProjectIdAndKind: jest.fn().mockResolvedValue([]),
    };
    takes = {
      hasPassedDraftForShot: jest.fn().mockResolvedValue(false),
      insertScore: jest.fn().mockResolvedValue({ id: 1, asset_id: 99, shot_id: 11, verdict: 'failed' }),
      getBudget: jest.fn().mockResolvedValue({ project_id: 7, alert_threshold: 100 }),
      listByProjectId: jest.fn().mockResolvedValue([]),
    };
    dispatcher = {
      enqueue: jest.fn().mockResolvedValue({ id: 501, status: 'queued' }),
    };
    service = new VdMotionService(
      config,
      projects as never,
      shots as never,
      assets as never,
      takes as never,
      dispatcher as never,
    );
    process.env.PTT_VD_KLING_API_KEY = 'test-kling';
  });

  it('blocks cine_motion_final without passed draft', async () => {
    await expect(service.enqueueFinal(11, 'idem-final')).rejects.toThrow(/take_draft_required/);
  });

  it('blocks shot after 5 failed takes', async () => {
    shots.getById
      .mockResolvedValueOnce({ ...shotRow, take_fail_count: 4 })
      .mockResolvedValueOnce({ ...shotRow, take_fail_count: 5, status: 'blocked' });
    const shot = await service.recordTakeFail(11);
    expect(shots.incrementTakeFailCount).toHaveBeenCalledWith(11, 5);
    expect(shots.updateStatus).toHaveBeenCalledWith(11, 'blocked');
    expect(shot.status).toBe('blocked');
  });

  it('returns needs_confirm when credit_estimate exceeds alert_threshold', async () => {
    takes.getBudget.mockResolvedValue({ project_id: 7, alert_threshold: 5 });
    const estimate = await service.getRenderEstimate(7, 11, 'cine_motion_final');
    expect(estimate.credit_estimate).toBeGreaterThan(5);
    expect(estimate.needs_confirm).toBe(true);
  });

  it('enqueues draft motion job', async () => {
    const out = await service.enqueueDraft(11, { prompt: 'move' }, 'idem-draft');
    expect(out).toEqual({ id: 501, status: 'queued' });
    expect(dispatcher.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: 'cine_motion_draft', projectId: 7 }),
    );
  });
});
