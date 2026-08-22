import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdDispatcherService } from '../orchestration/vd-dispatcher.service';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdAssetRepository, type VdAssetRow } from '../assets/vd-asset.repository';
import { composePrompt, VdBibleService } from '../bible/vd-bible.service';
import { VdShotRepository, type VdShotRow } from '../script/vd-shot.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdPromptRepository } from './vd-prompt.repository';

const HTTP_400 = new Set([
  'cmkt_cinematic_disabled',
  'vd_tables_missing',
  'invalid_body',
  'idempotency_key_required',
]);

function mapKnownError(err: unknown): never {
  const msg = err instanceof Error ? err.message : 'unknown';
  if (msg === 'vd_shot_not_found' || msg === 'vd_project_not_found') {
    throw new NotFoundException({ error: msg, message: msg });
  }
  if (msg === 'idempotency_key_conflict') {
    throw new ConflictException({ error: msg, message: msg });
  }
  if (HTTP_400.has(msg)) {
    throw new BadRequestException({ error: msg, message: msg });
  }
  throw err;
}

@Injectable()
export class VdPromptService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly shots: VdShotRepository,
    private readonly bibles: VdBibleService,
    private readonly prompts: VdPromptRepository,
    private readonly assets: VdAssetRepository,
    private readonly dispatcher: VdDispatcherService,
  ) {}

  private async requireShot(shotId: number): Promise<VdShotRow> {
    const shot = await this.shots.getById(shotId);
    if (!shot) throw new Error('vd_shot_not_found');
    return shot;
  }

  private async projectIdForShot(shot: VdShotRow): Promise<number> {
    const script = await this.projects.getScriptById(shot.script_id);
    if (!script) throw new Error('vd_shot_not_found');
    return script.project_id;
  }

  async listShotsByProject(projectId: number): Promise<VdShotRow[]> {
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    return this.shots.listByProjectId(projectId);
  }

  async listKeyframes(projectId: number): Promise<VdAssetRow[]> {
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    return this.assets.listKeyframesByProjectId(projectId, 50);
  }

  async enqueueKeyframe(
    shotId: number,
    body: Record<string, unknown>,
    idempotencyKey: string | undefined,
  ): Promise<{ id: number; status: 'queued' }> {
    const key = typeof idempotencyKey === 'string' ? idempotencyKey.trim() : '';
    if (!key) {
      throw new BadRequestException({
        error: 'idempotency_key_required',
        message: 'idempotency_key_required',
      });
    }

    try {
      assertCinematicEnabled(this.config);
    } catch (err) {
      mapKnownError(err);
    }

    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException({ error: 'invalid_body', message: 'invalid_body' });
    }

    const shot = await this.requireShot(shotId);
    const projectId = await this.projectIdForShot(shot);

    const lockRegions = await this.bibles.lockRegionsForProject(projectId);
    const style = await this.bibles.getStyle(projectId);
    const characters = await this.bibles.getCharacters(projectId);

    const promptOverride = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const composed = promptOverride || composePrompt(shot.action, { lock_regions: lockRegions });

    await this.prompts.upsertForShot({
      shot_id: shotId,
      body: composed,
      bible_snapshot_json: {
        style: style.body_json,
        characters: characters.body_json,
        lock_regions: lockRegions,
      },
      region_locked: lockRegions.length > 0,
    });

    if (shot.status === 'draft') {
      await this.shots.updateStatus(shotId, 'prompts_ready');
    }
    await this.shots.updateStatus(shotId, 'keyframe_pending');

    const width = Number(body.width);
    const height = Number(body.height);
    const seedRaw = body.seed;
    const payload: Record<string, unknown> = {
      shot_id: shotId,
      prompt: composed,
      width: Number.isFinite(width) && width > 0 ? Math.floor(width) : 1024,
      height: Number.isFinite(height) && height > 0 ? Math.floor(height) : 1024,
      credit_estimate: 3,
    };
    if (seedRaw != null && Number.isFinite(Number(seedRaw))) {
      payload.seed = Number(seedRaw);
    }

    let row;
    try {
      row = await this.dispatcher.enqueue({
        projectId,
        queue: 'q.image',
        jobType: 'cine_keyframe',
        payload,
        idempotencyKey: key,
      });
    } catch (err) {
      mapKnownError(err);
    }

    return { id: row.id, status: 'queued' };
  }

  async approveKeyframe(shotId: number): Promise<VdShotRow> {
    assertCinematicEnabled(this.config);
    const shot = await this.requireShot(shotId);
    if (shot.status !== 'keyframe_pending' && shot.status !== 'prompts_ready') {
      throw new Error('invalid_body');
    }
    await this.shots.updateStatus(shotId, 'keyframe_approved');
    const updated = await this.shots.getById(shotId);
    if (!updated) throw new Error('vd_shot_not_found');
    return updated;
  }
}
