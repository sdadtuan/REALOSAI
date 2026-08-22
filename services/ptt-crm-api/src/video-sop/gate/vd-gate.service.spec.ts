import { VdGateService } from './vd-gate.service';

describe('VdGateService', () => {
  const config = { contentMarketingVideoCinematicEnabled: true } as never;
  let projects: {
    getById: jest.Mock;
    getBrief: jest.Mock;
    updateStage: jest.Mock;
  };
  let gates: {
    getOrCreate: jest.Mock;
    getStatusMap: jest.Mock;
    updateStatus: jest.Mock;
    insertApproval: jest.Mock;
    insertRework: jest.Mock;
  };
  let shots: { listByProjectId: jest.Mock };
  let bibles: { getStyle: jest.Mock; getCharacters: jest.Mock };
  let jobs: { listByProjectId: jest.Mock };
  let service: VdGateService;

  beforeEach(() => {
    projects = {
      getById: jest.fn().mockResolvedValue({ id: 7, stage: 'keyframing' }),
      getBrief: jest.fn().mockResolvedValue({
        objective: 'tăng nhận biết',
        audience: 'khách hàng phổ thông A',
        offer: 'gói retainer content',
        duration_sec: 30,
        platform: 'reels',
        tone: 'rõ ràng',
        constraints: 'không mặt người',
        insight_ids: [],
      }),
      updateStage: jest.fn().mockResolvedValue(undefined),
    };
    gates = {
      getOrCreate: jest.fn().mockImplementation(async (projectId: number, gateNo: number) => ({
        id: gateNo,
        project_id: projectId,
        gate_no: gateNo,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      getStatusMap: jest.fn().mockResolvedValue({
        1: 'approved',
        2: 'pending',
        3: 'pending',
        4: 'pending',
      }),
      updateStatus: jest.fn().mockImplementation(async (projectId: number, gateNo: number, status: string) => ({
        id: gateNo,
        project_id: projectId,
        gate_no: gateNo,
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
      insertApproval: jest.fn().mockResolvedValue({ id: 1 }),
      insertRework: jest.fn().mockResolvedValue(undefined),
    };
    shots = {
      listByProjectId: jest.fn().mockResolvedValue([
        {
          id: 1,
          duration_ms: 3000,
          text_in_frame: false,
          contains_human: false,
          aspect: '9:16',
          camera: 'wide',
          action: 'walk',
          logo_in_ai_frame: false,
          seed: null,
          status: 'keyframe_approved',
        },
      ]),
    };
    bibles = {
      getStyle: jest.fn().mockResolvedValue({ palette: ['#000'], lens: '50mm', lighting: '', refs: [] }),
      getCharacters: jest.fn().mockResolvedValue({ items: [{ name: 'Hero', lock_regions: [], notes: '' }] }),
    };
    jobs = { listByProjectId: jest.fn().mockResolvedValue([]) };
    service = new VdGateService(
      config,
      projects as never,
      gates as never,
      shots as never,
      bibles as never,
      jobs as never,
    );
  });

  it('rejects override with short reason', async () => {
    await expect(
      service.approve(7, 1, { override: true, override_reason: 'ngắn' }, 'u@pttads.vn'),
    ).rejects.toThrow('override_reason');
  });

  it('blocks stage advance to animating when gate2 pending', async () => {
    await expect(service.advanceStage(7, 'animating')).rejects.toThrow('stage_guard');
  });

  it('blocks gate3 approve when no clip_selected', async () => {
    projects.getById.mockResolvedValue({ id: 7, stage: 'animating' });
    shots.listByProjectId.mockResolvedValue([
      {
        id: 1,
        duration_ms: 3000,
        text_in_frame: false,
        contains_human: false,
        aspect: '9:16',
        camera: 'wide',
        action: 'walk',
        logo_in_ai_frame: false,
        seed: null,
        status: 'clip_draft',
      },
    ]);
    await expect(
      service.approve(7, 3, { override: false }, 'u@pttads.vn'),
    ).rejects.toThrow('gate3_incomplete');
  });

  it('blocks gate4 approve when QC auto blocked', async () => {
    projects.getById.mockResolvedValue({ id: 7, stage: 'post_production' });
    jobs.listByProjectId.mockResolvedValue([
      {
        id: 1,
        job_type: 'cine_compose',
        output_json: {
          gate4_probe: { hasVideo: false, hasAudio: false, durationSec: 5, lufs: null },
        },
      },
    ]);
    await expect(
      service.approve(7, 4, { override: false }, 'u@pttads.vn'),
    ).rejects.toThrow('gate4_blocked');
  });
});
