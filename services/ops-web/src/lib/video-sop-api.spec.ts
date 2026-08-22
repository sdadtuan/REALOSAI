import { afterEach, describe, expect, it, vi } from 'vitest';
import { type StoredStaffUser } from './auth';
import {
  canEditVdBrief,
  canEditVdBible,
  canEditVdKeyframe,
  canEditVdScript,
  canEnqueueVdJob,
  canApproveGate1,
  canApproveGate2,
  canApproveGate3,
  canEditVdMotion,
  canEditVdBudget,
  canEditVdPost,
  canApproveVdGate,
  saveVdScript,
  vdAdminModelsPath,
  vdAdminProvidersPath,
  vdModelKey,
  vdModelVerifiedAt,
  vdProjectBibleCharactersPath,
  vdProjectBibleStylePath,
  vdProjectBriefInsightsPath,
  vdProjectBriefPath,
  vdProjectBriefReadyPath,
  vdProjectCreatePath,
  vdProjectGetPath,
  vdProjectGateApprovePath,
  vdProjectGatePath,
  vdProjectGateRejectPath,
  vdProjectIdeasGeneratePath,
  vdProjectIdeasPath,
  vdProjectJobsPath,
  vdProjectKeyframesPath,
  vdProjectScriptsPath,
  vdProjectShotsPath,
  vdProjectShotlistReadyPath,
  vdProjectStagePath,
  vdPromptTemplatesPath,
  vdScriptShotsPath,
  vdShotApproveKeyframePath,
  vdShotJobsPath,
  sc04AddShotPayload,
} from './video-sop-api';

function staff(caps: Array<{ section: string; action: string }>): StoredStaffUser {
  return {
    id: '1',
    email: 'u@pttads.vn',
    display_name: 'Test',
    position_id: 2,
    caps,
  };
}

describe('video-sop-api path helpers', () => {
  it('vdProjectCreatePath is POST collection', () => {
    expect(vdProjectCreatePath()).toBe('/api/v1/vd/projects');
  });

  it('vdProjectGetPath interpolates id', () => {
    expect(vdProjectGetPath(7)).toBe('/api/v1/vd/projects/7');
  });

  it('vdProjectJobsPath interpolates id', () => {
    expect(vdProjectJobsPath(7)).toBe('/api/v1/vd/projects/7/jobs');
  });

  it('vdAdminProvidersPath is admin collection', () => {
    expect(vdAdminProvidersPath()).toBe('/api/v1/vd/admin/providers');
  });

  it('vdAdminModelsPath is admin collection', () => {
    expect(vdAdminModelsPath()).toBe('/api/v1/vd/admin/models');
  });

  it('vdModelKey equals row.code', () => {
    expect(vdModelKey({ code: 'video.kling.v3.pro' })).toBe('video.kling.v3.pro');
  });

  it('vdModelVerifiedAt reads capability_json.verified_at', () => {
    expect(vdModelVerifiedAt({ verified_at: '2026-08-20', route: 'VIA_LEONARDO' })).toBe(
      '2026-08-20',
    );
    expect(vdModelVerifiedAt('{"verified_at":"2026-08-20"}')).toBe('2026-08-20');
    expect(vdModelVerifiedAt({})).toBe('');
    expect(vdModelVerifiedAt('not-json')).toBe('');
  });

  it('vdProjectBriefPath interpolates id', () => {
    expect(vdProjectBriefPath(7)).toBe('/api/v1/vd/projects/7/brief');
  });

  it('vdProjectBriefReadyPath interpolates id', () => {
    expect(vdProjectBriefReadyPath(7)).toBe('/api/v1/vd/projects/7/brief/ready');
  });

  it('vdProjectBriefInsightsPath interpolates id', () => {
    expect(vdProjectBriefInsightsPath(7)).toBe('/api/v1/vd/projects/7/brief/insights');
  });

  it('vdProjectIdeasPath interpolates id', () => {
    expect(vdProjectIdeasPath(7)).toBe('/api/v1/vd/projects/7/ideas');
  });

  it('vdProjectIdeasGeneratePath interpolates id', () => {
    expect(vdProjectIdeasGeneratePath(7)).toBe('/api/v1/vd/projects/7/ideas/generate');
  });

  it('vdProjectScriptsPath interpolates id', () => {
    expect(vdProjectScriptsPath(7)).toBe('/api/v1/vd/projects/7/scripts');
  });

  it('vdScriptShotsPath interpolates id', () => {
    expect(vdScriptShotsPath(3)).toBe('/api/v1/vd/scripts/3/shots');
  });

  it('vdPromptTemplatesPath is collection', () => {
    expect(vdPromptTemplatesPath()).toBe('/api/v1/vd/prompt-templates');
  });

  it('vdProjectBibleStylePath interpolates id', () => {
    expect(vdProjectBibleStylePath(7)).toBe('/api/v1/vd/projects/7/bibles/style');
  });

  it('vdProjectBibleCharactersPath interpolates id', () => {
    expect(vdProjectBibleCharactersPath(7)).toBe('/api/v1/vd/projects/7/bibles/characters');
  });

  it('vdShotJobsPath interpolates id', () => {
    expect(vdShotJobsPath(5)).toBe('/api/v1/vd/shots/5/jobs');
  });

  it('vdProjectShotsPath interpolates id', () => {
    expect(vdProjectShotsPath(7)).toBe('/api/v1/vd/projects/7/shots');
  });

  it('vdProjectKeyframesPath interpolates id', () => {
    expect(vdProjectKeyframesPath(7)).toBe('/api/v1/vd/projects/7/keyframes');
  });

  it('vdProjectGatePath interpolates id and gate', () => {
    expect(vdProjectGatePath(7, 1)).toBe('/api/v1/vd/projects/7/gates/1');
  });

  it('vdProjectGateApprovePath interpolates id and gate', () => {
    expect(vdProjectGateApprovePath(7, 2)).toBe('/api/v1/vd/projects/7/gates/2/approve');
  });

  it('vdProjectGateRejectPath interpolates id and gate', () => {
    expect(vdProjectGateRejectPath(7, 1)).toBe('/api/v1/vd/projects/7/gates/1/reject');
  });

  it('vdProjectShotlistReadyPath interpolates id', () => {
    expect(vdProjectShotlistReadyPath(7)).toBe('/api/v1/vd/projects/7/shotlist/ready');
  });

  it('vdProjectStagePath interpolates id', () => {
    expect(vdProjectStagePath(7)).toBe('/api/v1/vd/projects/7/stage');
  });

  it('vdShotApproveKeyframePath interpolates id', () => {
    expect(vdShotApproveKeyframePath(5)).toBe('/api/v1/vd/shots/5/approve-keyframe');
  });
});

describe('canEditVdBrief (same as API PUT/ready)', () => {
  it('allows crm_vd.project edit', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_vd.project', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies view-only crm_vd.project', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_vd.project', action: 'view' }]))).toBe(false);
  });

  it('denies create-only crm_vd.project', () => {
    expect(canEditVdBrief(staff([{ section: 'crm_vd.project', action: 'create' }]))).toBe(false);
  });

  it('denies null user', () => {
    expect(canEditVdBrief(null)).toBe(false);
  });
});

describe('canEditVdScript (same as API ideas/script/shots)', () => {
  it('allows crm_vd.script edit', () => {
    expect(canEditVdScript(staff([{ section: 'crm_vd.script', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_vd.project edit', () => {
    expect(canEditVdScript(staff([{ section: 'crm_vd.project', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEditVdScript(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies view-only crm_vd.script', () => {
    expect(canEditVdScript(staff([{ section: 'crm_vd.script', action: 'view' }]))).toBe(false);
  });

  it('denies null user', () => {
    expect(canEditVdScript(null)).toBe(false);
  });
});

describe('canEditVdKeyframe (same as API POST shot jobs)', () => {
  it('allows crm_vd.keyframe edit', () => {
    expect(canEditVdKeyframe(staff([{ section: 'crm_vd.keyframe', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_vd.project edit', () => {
    expect(canEditVdKeyframe(staff([{ section: 'crm_vd.project', action: 'edit' }]))).toBe(true);
  });

  it('denies null user', () => {
    expect(canEditVdKeyframe(null)).toBe(false);
  });
});

describe('canEditVdBible (same as API PUT bibles)', () => {
  it('allows crm_vd.bible edit', () => {
    expect(canEditVdBible(staff([{ section: 'crm_vd.bible', action: 'edit' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEditVdBible(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies null user', () => {
    expect(canEditVdBible(null)).toBe(false);
  });
});

describe('canApproveGate1 (same as API gate 1 approve)', () => {
  it('allows crm_vd.gate1 approve', () => {
    expect(canApproveGate1(staff([{ section: 'crm_vd.gate1', action: 'approve' }]))).toBe(true);
  });

  it('allows crm_vd.project edit', () => {
    expect(canApproveGate1(staff([{ section: 'crm_vd.project', action: 'edit' }]))).toBe(true);
  });

  it('denies null user', () => {
    expect(canApproveGate1(null)).toBe(false);
  });
});

describe('canApproveGate2 (same as API gate 2 approve)', () => {
  it('allows crm_vd.gate2 approve', () => {
    expect(canApproveGate2(staff([{ section: 'crm_vd.gate2', action: 'approve' }]))).toBe(true);
  });

  it('denies gate1 approve only', () => {
    expect(canApproveGate2(staff([{ section: 'crm_vd.gate1', action: 'approve' }]))).toBe(false);
  });
});

describe('canApproveGate3 (same as API gate 3 approve)', () => {
  it('allows crm_vd.gate3 approve', () => {
    expect(canApproveGate3(staff([{ section: 'crm_vd.gate3', action: 'approve' }]))).toBe(true);
  });

  it('denies gate2 approve only', () => {
    expect(canApproveGate3(staff([{ section: 'crm_vd.gate2', action: 'approve' }]))).toBe(false);
  });
});

describe('canEditVdMotion (same as API motion jobs)', () => {
  it('allows crm_vd.motion edit', () => {
    expect(canEditVdMotion(staff([{ section: 'crm_vd.motion', action: 'edit' }]))).toBe(true);
  });

  it('denies view only', () => {
    expect(canEditVdMotion(staff([{ section: 'crm_vd.motion', action: 'view' }]))).toBe(false);
  });
});

describe('canEditVdBudget (same as API PUT budget)', () => {
  it('allows crm_vd.budget edit', () => {
    expect(canEditVdBudget(staff([{ section: 'crm_vd.budget', action: 'edit' }]))).toBe(true);
  });

  it('denies view only', () => {
    expect(canEditVdBudget(staff([{ section: 'crm_vd.budget', action: 'view' }]))).toBe(false);
  });
});

describe('canEditVdPost (same as API POST post/compose)', () => {
  it('allows crm_vd.post edit', () => {
    expect(canEditVdPost(staff([{ section: 'crm_vd.post', action: 'edit' }]))).toBe(true);
  });

  it('denies view only', () => {
    expect(canEditVdPost(staff([{ section: 'crm_vd.post', action: 'view' }]))).toBe(false);
  });
});

describe('canApproveVdGate', () => {
  it('routes gate 1 to gate1 cap', () => {
    expect(
      canApproveVdGate(staff([{ section: 'crm_vd.gate1', action: 'approve' }]), 1),
    ).toBe(true);
  });

  it('routes gate 2 to gate2 cap', () => {
    expect(
      canApproveVdGate(staff([{ section: 'crm_vd.gate2', action: 'approve' }]), 2),
    ).toBe(true);
  });

  it('routes gate 3 to gate3 cap', () => {
    expect(
      canApproveVdGate(staff([{ section: 'crm_vd.gate3', action: 'approve' }]), 3),
    ).toBe(true);
  });

  it('allows gate 4 via crm_vd.qc edit', () => {
    expect(canApproveVdGate(staff([{ section: 'crm_vd.qc', action: 'edit' }]), 4)).toBe(true);
  });

  it('denies unknown gate', () => {
    expect(canApproveVdGate(staff([{ section: 'crm_vd.gate1', action: 'approve' }]), 9)).toBe(
      false,
    );
  });
});

describe('canEnqueueVdJob (same as API POST)', () => {
  it('allows crm_vd.project create', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_vd.project', action: 'create' }]))).toBe(true);
  });

  it('allows crm_content write', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_content', action: 'write' }]))).toBe(true);
  });

  it('denies view-only crm_vd.project', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_vd.project', action: 'view' }]))).toBe(false);
  });

  it('denies view-only crm_content', () => {
    expect(canEnqueueVdJob(staff([{ section: 'crm_content', action: 'view' }]))).toBe(false);
  });

  it('denies null user', () => {
    expect(canEnqueueVdJob(null)).toBe(false);
  });
});

describe('sc04AddShotPayload', () => {
  it('includes contains_human as boolean false so FR-R03 can pass', () => {
    const payload = sc04AddShotPayload({
      duration_ms: 3000,
      camera: 'wide',
      action: 'pan left',
      aspect: '9:16',
    });
    expect(typeof payload.contains_human).toBe('boolean');
    expect(payload.contains_human).toBe(false);
    expect(payload.text_in_frame).toBe(false);
    expect(payload.logo_in_ai_frame).toBe(false);
    expect(payload.duration_ms).toBe(3000);
    expect(payload.camera).toBe('wide');
    expect(payload.action).toBe('pan left');
    expect(payload.aspect).toBe('9:16');
  });
});

describe('saveVdScript', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PUTs markdown to project scripts path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ id: 10, project_id: 7, version: 1, markdown: 'hi' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await saveVdScript('tok', 7, 'hi');

    expect(fetchMock).toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/api/v1/vd/projects/7/scripts');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ markdown: 'hi' }));
  });
});
