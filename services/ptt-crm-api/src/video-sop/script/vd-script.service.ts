import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdGateService } from '../gate/vd-gate.service';
import { parseIdeaSummaries, selectTextGen, STUB_IDEAS } from '../adapters/i-text-gen';
import { parseVideoScript, type VideoScript } from '../adapters/video-script.schema';
import { VdDispatcherService } from '../orchestration/vd-dispatcher.service';
import type { VdScriptRow } from '../project/vd-project.repository';
import { VdProjectRepository } from '../project/vd-project.repository';
import {
  assertFeasibilityPass,
  assertShotFeasibility,
  evaluateFeasibility,
  PER_SHOT_RULE_IDS,
  type VdShotDraft,
} from '../rules/vd-feasibility.rules';
import { assertStageTransition } from '../rules/vd-stage.guard';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdIdeaRepository, type VdIdeaRow, type VdPromptTemplateRow } from './vd-idea.repository';
import { VdShotRepository, type VdShotRow } from './vd-shot.repository';

export type { VdIdeaRow, VdPromptTemplateRow, VdScriptRow, VdShotRow };

function asBool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseShotDraft(body: Record<string, unknown>): VdShotDraft {
  const duration = Number(body.duration_ms);
  if (!Number.isFinite(duration)) {
    throw new Error('invalid_body');
  }
  const seedRaw = body.seed;
  const seed =
    seedRaw == null || seedRaw === ''
      ? null
      : Number.isFinite(Number(seedRaw))
        ? Number(seedRaw)
        : null;
  return {
    duration_ms: Math.floor(duration),
    text_in_frame: body.text_in_frame === true,
    contains_human: body.contains_human,
    aspect: typeof body.aspect === 'string' ? body.aspect : '',
    camera: typeof body.camera === 'string' ? body.camera : '',
    action: typeof body.action === 'string' ? body.action : '',
    logo_in_ai_frame: body.logo_in_ai_frame === true,
    seed,
    status: typeof body.status === 'string' && body.status.trim() ? body.status : 'draft',
  };
}

function projectFromBrief(brief: Record<string, unknown> | null): {
  duration_sec: number;
  platform: string;
} {
  const duration =
    brief && typeof brief.duration_sec === 'number' && Number.isFinite(brief.duration_sec)
      ? brief.duration_sec
      : 30;
  const platform =
    brief && typeof brief.platform === 'string' && brief.platform.trim()
      ? brief.platform
      : 'reels';
  return { duration_sec: duration, platform };
}

function toInsertInput(scriptId: number, draft: VdShotDraft) {
  return {
    script_id: scriptId,
    duration_ms: draft.duration_ms,
    camera: draft.camera,
    action: draft.action,
    aspect: draft.aspect || undefined,
    contains_human: asBool(draft.contains_human),
    text_in_frame: draft.text_in_frame,
    logo_in_ai_frame: draft.logo_in_ai_frame,
    seed: draft.seed,
  };
}

function perShotFeasibility(shot: VdShotRow) {
  return evaluateFeasibility({ duration_sec: 30, platform: 'reels' }, [
    {
      duration_ms: shot.duration_ms,
      text_in_frame: shot.text_in_frame,
      contains_human: shot.contains_human,
      aspect: shot.aspect,
      camera: shot.camera,
      action: shot.action,
      logo_in_ai_frame: shot.logo_in_ai_frame,
      seed: shot.seed,
      status: shot.status,
    },
  ]).filter((row) => PER_SHOT_RULE_IDS.has(row.id));
}

@Injectable()
export class VdScriptService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly ideas: VdIdeaRepository,
    private readonly shots: VdShotRepository,
    private readonly dispatcher: VdDispatcherService,
    private readonly gateService: VdGateService,
  ) {}

  private async requireProject(id: number) {
    const row = await this.projects.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  private async requireScript(id: number): Promise<VdScriptRow> {
    const row = await this.projects.getScriptById(id);
    if (!row) throw new Error('vd_script_not_found');
    return row;
  }

  async materializeStubIdeas(projectId: number): Promise<VdIdeaRow[]> {
    const gen = selectTextGen({ OPENAI_API_KEY: '' });
    const result = await gen.complete({ system: 'director', user: 'ideas' });
    const summaries = parseIdeaSummaries(result);
    return this.ideas.replaceForProject(projectId, summaries.length === 3 ? summaries : [...STUB_IDEAS]);
  }

  async applyDirectorResult(projectId: number, result: unknown): Promise<VdIdeaRow[]> {
    const summaries = parseIdeaSummaries(result);
    return this.ideas.replaceForProject(projectId, summaries);
  }

  parseStructuredScript(result: unknown): VideoScript {
    return parseVideoScript(result);
  }

  async applyVideoScriptShots(scriptId: number, result: unknown): Promise<VdShotRow[]> {
    const script = await this.requireScript(scriptId);
    const parsed = parseVideoScript(result);
    const drafts: VdShotDraft[] = parsed.shots.map((shot) => ({
      duration_ms: Math.max(1, Math.round(shot.duration_sec * 1000)),
      text_in_frame: Boolean(shot.onscreen_text.trim()),
      contains_human: shot.risk_flags.includes('human'),
      aspect: '',
      camera: shot.camera,
      action: shot.motion_prompt || shot.scene_desc,
      logo_in_ai_frame: shot.risk_flags.includes('logo'),
      seed: null,
      status: 'draft',
    }));
    const brief = await this.projects.getBrief(script.project_id);
    assertFeasibilityPass(projectFromBrief(brief), drafts);
    return this.shots.replaceForScript(
      scriptId,
      drafts.map((draft) => toInsertInput(scriptId, draft)),
    );
  }

  async generateIdeas(
    projectId: number,
    idempotencyKey: string | undefined,
  ): Promise<{ id: number; status: 'queued' }> {
    const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
    if (!key) throw new Error('idempotency_key_required');
    assertCinematicEnabled(this.config);
    const project = await this.requireProject(projectId);
    if (project.stage !== 'brief_ready' && project.stage !== 'ideation') {
      throw new Error('stage_guard');
    }
    if (project.stage === 'brief_ready') {
      assertStageTransition(project.stage, 'ideation');
      await this.projects.updateStage(projectId, 'ideation');
    }
    const row = await this.dispatcher.enqueue({
      projectId,
      queue: 'q.text',
      jobType: 'cine_director',
      payload: {},
      idempotencyKey: key,
    });
    return { id: row.id, status: 'queued' };
  }

  async listIdeas(projectId: number): Promise<VdIdeaRow[]> {
    await this.requireProject(projectId);
    return this.ideas.listByProjectId(projectId);
  }

  async selectIdea(projectId: number, ideaId: number): Promise<VdIdeaRow[]> {
    assertCinematicEnabled(this.config);
    await this.requireProject(projectId);
    return this.ideas.selectIdea(projectId, ideaId);
  }

  async listScripts(projectId: number): Promise<VdScriptRow[]> {
    await this.requireProject(projectId);
    return this.projects.listScripts(projectId);
  }

  async createScript(projectId: number, body: Record<string, unknown>): Promise<VdScriptRow> {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    const markdown = typeof body.markdown === 'string' ? body.markdown : '';
    const project = await this.requireProject(projectId);
    if (project.stage === 'brief_ready' || project.stage === 'ideation') {
      assertStageTransition(project.stage, 'scripting');
      await this.projects.updateStage(projectId, 'scripting');
    } else if (project.stage !== 'scripting') {
      throw new Error('stage_guard');
    }
    const existing = await this.projects.listScripts(projectId);
    const version = existing.length === 0 ? 1 : Math.max(...existing.map((s) => s.version)) + 1;
    return this.projects.insertScriptRow(projectId, version, markdown);
  }

  async saveScript(projectId: number, body: Record<string, unknown>): Promise<VdScriptRow> {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    const markdown = typeof body.markdown === 'string' ? body.markdown : '';
    const project = await this.requireProject(projectId);
    if (project.stage === 'brief_ready' || project.stage === 'ideation') {
      assertStageTransition(project.stage, 'scripting');
      await this.projects.updateStage(projectId, 'scripting');
    } else if (project.stage !== 'scripting') {
      throw new Error('stage_guard');
    }
    const existing = await this.projects.listScripts(projectId);
    if (existing.length === 0) {
      return this.projects.insertScriptRow(projectId, 1, markdown);
    }
    const latest = existing.reduce((acc, row) => (row.version > acc.version ? row : acc));
    return this.projects.updateScriptMarkdown(latest.id, markdown);
  }

  async listShots(scriptId: number): Promise<Array<VdShotRow & { feasibility: { id: string; ok: boolean }[] }>> {
    await this.requireScript(scriptId);
    const rows = await this.shots.listByScriptId(scriptId);
    return rows.map((row) => ({ ...row, feasibility: perShotFeasibility(row) }));
  }

  async addShot(
    scriptId: number,
    body: Record<string, unknown>,
  ): Promise<VdShotRow | VdShotRow[]> {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    const script = await this.requireScript(scriptId);
    if (await this.gateService.isShotlistImmutable(script.project_id)) {
      throw new Error('shotlist_immutable');
    }
    if (Array.isArray(body.shots)) {
      const script = await this.requireScript(scriptId);
      const drafts = body.shots.map((item) => {
        if (item == null || typeof item !== 'object' || Array.isArray(item)) {
          throw new Error('invalid_body');
        }
        return parseShotDraft(item as Record<string, unknown>);
      });
      const brief = await this.projects.getBrief(script.project_id);
      assertFeasibilityPass(projectFromBrief(brief), drafts);
      return this.shots.replaceForScript(
        scriptId,
        drafts.map((draft) => toInsertInput(scriptId, draft)),
      );
    }
    await this.requireScript(scriptId);
    const draft = parseShotDraft(body);
    assertShotFeasibility(draft);
    return this.shots.insert(toInsertInput(scriptId, draft));
  }

  listTemplates(): Promise<VdPromptTemplateRow[]> {
    return this.ideas.listTemplates();
  }
}
