import { STUB_IDEAS } from '../adapters/i-text-gen';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdIdeaRepository } from './vd-idea.repository';
import { VdShotRepository, type VdShotRow } from './vd-shot.repository';
import { VdScriptService } from './vd-script.service';

function makeScriptService(opts?: { cinematic?: boolean }) {
  const config = {
    databaseUrl: 'postgres://127.0.0.1:1/none',
    contentMarketingVideoCinematicEnabled: opts?.cinematic ?? false,
  };
  const projects = new VdProjectRepository(config as never);
  jest.spyOn(projects, 'ensurePgReady').mockResolvedValue(false);
  const ideas = new VdIdeaRepository(config as never);
  jest.spyOn(ideas, 'ensurePgReady').mockResolvedValue(false);
  const shots = new VdShotRepository(config as never);
  jest.spyOn(shots, 'ensurePgReady').mockResolvedValue(false);
  const dispatcher = { enqueue: jest.fn() };
  const gateService = { isShotlistImmutable: jest.fn().mockResolvedValue(false) };
  return {
    service: new VdScriptService(
      config as never,
      projects,
      ideas,
      shots,
      dispatcher as never,
      gateService as never,
    ),
    projects,
    shots,
    gateService,
  };
}

const validShotBody = {
  duration_ms: 3000,
  text_in_frame: false,
  contains_human: false,
  aspect: '9:16',
  camera: 'push in',
  action: 'walk',
  logo_in_ai_frame: false,
  seed: 1,
};

const scriptingProject = {
  id: 1,
  lifecycle_id: 3,
  client_id: null,
  cmkt_item_id: 1,
  title: 't',
  stage: 'scripting' as const,
  status: 'active' as const,
  created_by: 'a@b.c',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('VdScriptService', () => {
  it('writes three stub ideas ordinal 1..3', async () => {
    const { service } = makeScriptService();
    const rows = await service.materializeStubIdeas(1);
    expect(rows.map((r) => r.ordinal)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.summary)).toEqual([...STUB_IDEAS]);
  });

  it('addShot throws feasibility_blocked when duration_ms is 16000', async () => {
    const { service, projects, shots } = makeScriptService({ cinematic: true });
    jest.spyOn(projects, 'getScriptById').mockResolvedValue({
      id: 1,
      project_id: 1,
      version: 1,
      markdown: '',
    });
    const insert = jest.spyOn(shots, 'insert');
    await expect(
      service.addShot(1, { ...validShotBody, duration_ms: 16000 }),
    ).rejects.toThrow(/feasibility_blocked/);
    expect(insert).not.toHaveBeenCalled();
  });

  it('addShot batch throws feasibility_blocked when shot count is 1', async () => {
    const { service, projects, shots } = makeScriptService({ cinematic: true });
    jest.spyOn(projects, 'getScriptById').mockResolvedValue({
      id: 1,
      project_id: 1,
      version: 1,
      markdown: '',
    });
    jest.spyOn(projects, 'getBrief').mockResolvedValue({});
    const insert = jest.spyOn(shots, 'insert');
    await expect(service.addShot(1, { shots: [{ ...validShotBody }] })).rejects.toThrow(
      /feasibility_blocked/,
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('saveScript twice keeps same script id and shot script_id', async () => {
    const { service, projects, shots } = makeScriptService({ cinematic: true });
    const script = { id: 10, project_id: 1, version: 1, markdown: 'v1' };
    const scripts = [script];
    const shotRows: VdShotRow[] = [];
    jest.spyOn(projects, 'getById').mockResolvedValue(scriptingProject);
    jest.spyOn(projects, 'listScripts').mockImplementation(async () => scripts.map((row) => ({ ...row })));
    jest.spyOn(projects, 'getScriptById').mockImplementation(async (id) => {
      const row = scripts.find((s) => s.id === id);
      return row ? { ...row } : null;
    });
    const insert = jest.spyOn(projects, 'insertScriptRow').mockImplementation(async (projectId, version, markdown) => {
      const row = { id: 11, project_id: projectId, version, markdown };
      scripts.push(row);
      return row;
    });
    jest.spyOn(projects, 'updateScriptMarkdown').mockImplementation(async (id, markdown) => {
      const row = scripts.find((s) => s.id === id);
      if (!row) throw new Error('vd_script_not_found');
      row.markdown = markdown;
      return { ...row };
    });
    jest.spyOn(shots, 'insert').mockImplementation(async (input) => {
      const row = {
        id: 1,
        script_id: input.script_id,
        ordinal: 1,
        status: 'draft',
        duration_ms: input.duration_ms,
        camera: input.camera,
        action: input.action,
        aspect: input.aspect ?? '9:16',
        contains_human: Boolean(input.contains_human),
        text_in_frame: Boolean(input.text_in_frame),
        logo_in_ai_frame: Boolean(input.logo_in_ai_frame),
        seed: input.seed ?? null,
        take_fail_count: 0,
      };
      shotRows.push(row);
      return row;
    });
    jest.spyOn(shots, 'listByScriptId').mockImplementation(async (scriptId) =>
      shotRows.filter((row) => row.script_id === scriptId).map((row) => ({ ...row })),
    );

    await service.addShot(10, validShotBody);
    const first = await service.saveScript(1, { markdown: 'updated-1' });
    const second = await service.saveScript(1, { markdown: 'updated-2' });

    expect(scripts).toHaveLength(1);
    expect(first.id).toBe(10);
    expect(second.id).toBe(10);
    expect(second.version).toBe(1);
    expect(insert).not.toHaveBeenCalled();
    expect(shotRows[0]?.script_id).toBe(10);
    expect(shotRows[0]?.script_id).toBe(second.id);
  });
});
