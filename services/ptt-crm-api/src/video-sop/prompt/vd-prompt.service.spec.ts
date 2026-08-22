import { VdPromptService } from './vd-prompt.service';

describe('VdPromptService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;
  let projects: {
    getById: jest.Mock;
    getScriptById: jest.Mock;
  };
  let shots: {
    getById: jest.Mock;
    updateStatus: jest.Mock;
    listByProjectId: jest.Mock;
  };
  let bibles: {
    lockRegionsForProject: jest.Mock;
    getStyle: jest.Mock;
    getCharacters: jest.Mock;
  };
  let prompts: { upsertForShot: jest.Mock };
  let assets: { listKeyframesByProjectId: jest.Mock };
  let dispatcher: { enqueue: jest.Mock };
  let service: VdPromptService;

  beforeEach(() => {
    projects = {
      getById: jest.fn().mockResolvedValue({ id: 7, stage: 'scripting' }),
      getScriptById: jest.fn().mockResolvedValue({ id: 10, project_id: 7 }),
    };
    shots = {
      getById: jest.fn().mockResolvedValue({
        id: 5,
        script_id: 10,
        ordinal: 1,
        status: 'draft',
        action: 'walk {{lock:face}}',
        duration_ms: 3000,
        camera: 'wide',
        aspect: '9:16',
        contains_human: false,
        text_in_frame: false,
        logo_in_ai_frame: false,
        seed: null,
        take_fail_count: 0,
      }),
      updateStatus: jest.fn().mockResolvedValue(undefined),
      listByProjectId: jest.fn().mockResolvedValue([]),
    };
    bibles = {
      lockRegionsForProject: jest.fn().mockResolvedValue(['face']),
      getStyle: jest.fn().mockResolvedValue({ project_id: 7, body_json: {} }),
      getCharacters: jest.fn().mockResolvedValue({ project_id: 7, body_json: { items: [] } }),
    };
    prompts = { upsertForShot: jest.fn().mockResolvedValue({ id: 1, shot_id: 5, body: 'x' }) };
    assets = { listKeyframesByProjectId: jest.fn().mockResolvedValue([]) };
    dispatcher = { enqueue: jest.fn().mockResolvedValue({ id: 99, status: 'queued' }) };
    service = new VdPromptService(
      config,
      projects as never,
      shots as never,
      bibles as never,
      prompts as never,
      assets as never,
      dispatcher as never,
    );
  });

  it('enqueueKeyframe does not change project stage', async () => {
    await service.enqueueKeyframe(5, {}, 'smoke-s4-1');
    expect(projects.getById).not.toHaveBeenCalled();
    expect(dispatcher.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 7,
        jobType: 'cine_keyframe',
        queue: 'q.image',
      }),
    );
  });

  it('transitions shot draft to keyframe_pending', async () => {
    await service.enqueueKeyframe(5, {}, 'key-1');
    expect(shots.updateStatus).toHaveBeenCalledWith(5, 'prompts_ready');
    expect(shots.updateStatus).toHaveBeenCalledWith(5, 'keyframe_pending');
  });
});
