import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import type { IVideoGen, VdVideoProvider } from '../adapters/i-video-gen';
import { selectVideoGen, videoQueueForProvider, modelKeyForIntent, providerHintForIntent } from '../orchestration/vd-model-router';
import { VdAssetRepository } from '../assets/vd-asset.repository';
import { VdDispatcherService } from '../orchestration/vd-dispatcher.service';
import { VdProjectRepository } from '../project/vd-project.repository';
import { VdShotRepository, type VdShotRow } from '../script/vd-shot.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdTakeRepository, type VdTakeScoreRow } from './vd-take.repository';

export type VdRenderEstimate = {
  shot_id: number;
  job_type: string;
  credit_estimate: number;
  alert_threshold: number;
  needs_confirm: boolean;
};

export type VdTakeView = {
  asset_id: number;
  shot_id: number;
  url: string;
  sha256: string | null;
  duration_ms: number | null;
  verdict: string | null;
  artifact_json: Record<string, unknown>;
};

const DRAFT_CREDIT_PER_SEC = 2;
const FINAL_CREDIT_PER_SEC = 5;

@Injectable()
export class VdMotionService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly shots: VdShotRepository,
    private readonly assets: VdAssetRepository,
    private readonly takes: VdTakeRepository,
    private readonly dispatcher: VdDispatcherService,
  ) {}

  private videoGenEnv() {
    return {
      PTT_VD_KLING_API_KEY: (process.env.PTT_VD_KLING_API_KEY ?? '').trim(),
      PTT_VD_RUNWAY_API_KEY: (process.env.PTT_VD_RUNWAY_API_KEY ?? '').trim(),
      PTT_VD_LEONARDO_API_KEY: (process.env.PTT_VD_LEONARDO_API_KEY ?? '').trim(),
    };
  }

  selectVideoGen(hint?: VdVideoProvider): IVideoGen {
    return selectVideoGen(this.videoGenEnv(), hint);
  }

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

  creditEstimateForShot(shot: VdShotRow, jobType: string): number {
    const durationSec = Math.max(1, Math.ceil(shot.duration_ms / 1000));
    if (jobType === 'cine_motion_final') {
      return durationSec * FINAL_CREDIT_PER_SEC;
    }
    return durationSec * DRAFT_CREDIT_PER_SEC;
  }

  async getRenderEstimate(projectId: number, shotId: number, jobType: string): Promise<VdRenderEstimate> {
    assertCinematicEnabled(this.config);
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');
    const shot = await this.requireShot(shotId);
    const shotProjectId = await this.projectIdForShot(shot);
    if (shotProjectId !== projectId) throw new Error('vd_shot_not_found');

    const normalized = jobType.trim() || 'cine_motion_draft';
    if (normalized !== 'cine_motion_draft' && normalized !== 'cine_motion_final') {
      throw new Error('invalid_body');
    }

    const budget = await this.takes.getBudget(projectId);
    const credit_estimate = this.creditEstimateForShot(shot, normalized);
    return {
      shot_id: shotId,
      job_type: normalized,
      credit_estimate,
      alert_threshold: budget.alert_threshold,
      needs_confirm: credit_estimate > budget.alert_threshold,
    };
  }

  async enqueueDraft(
    shotId: number,
    body: Record<string, unknown>,
    idempotencyKey: string,
  ): Promise<{ id: number; status: 'queued' }> {
    assertCinematicEnabled(this.config);
    const key = idempotencyKey.trim();
    if (!key) throw new Error('idempotency_key_required');

    const shot = await this.requireShot(shotId);
    if (shot.status === 'blocked') throw new Error('invalid_body');
    if (shot.status !== 'keyframe_approved' && shot.status !== 'clip_draft' && shot.status !== 'plan_b') {
      throw new Error('stage_guard');
    }

    const projectId = await this.projectIdForShot(shot);
    const intent = 'DRAFT' as const;
    const gen = this.selectVideoGen(providerHintForIntent(intent));
    const queue = videoQueueForProvider(gen.providerName);

    const keyframes = await this.assets.listKeyframesByProjectId(projectId, 20);
    const imageUrl =
      typeof body.image_url === 'string' && body.image_url.trim()
        ? body.image_url.trim()
        : keyframes[0]?.url || keyframes[0]?.storage_key || `shot://${shotId}`;

    const prompt =
      typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt.trim() : shot.action;
    const durationSec = Math.max(1, Math.ceil(shot.duration_ms / 1000));

    const row = await this.dispatcher.enqueue({
      projectId,
      queue,
      jobType: 'cine_motion_draft',
      payload: {
        shot_id: shotId,
        imageUrl,
        prompt,
        durationSec,
        intent,
        model_key: modelKeyForIntent(intent),
        providerHint: gen.providerName,
        credit_estimate: this.creditEstimateForShot(shot, 'cine_motion_draft'),
      },
      idempotencyKey: key,
    });

    return { id: row.id, status: 'queued' };
  }

  async enqueueFinal(shotId: number, idempotencyKey: string): Promise<{ id: number; status: 'queued' }> {
    assertCinematicEnabled(this.config);
    const key = idempotencyKey.trim();
    if (!key) throw new Error('idempotency_key_required');

    const shot = await this.requireShot(shotId);
    if (shot.status === 'blocked') throw new Error('invalid_body');

    const hasPassed = await this.takes.hasPassedDraftForShot(shotId);
    if (!hasPassed) throw new Error('take_draft_required');

    const projectId = await this.projectIdForShot(shot);
    const intent = 'FINAL' as const;
    const gen = this.selectVideoGen(providerHintForIntent(intent));
    const queue = videoQueueForProvider(gen.providerName);
    const keyframes = await this.assets.listKeyframesByProjectId(projectId, 20);
    const imageUrl = keyframes[0]?.url || keyframes[0]?.storage_key || `shot://${shotId}`;

    const row = await this.dispatcher.enqueue({
      projectId,
      queue,
      jobType: 'cine_motion_final',
      payload: {
        shot_id: shotId,
        imageUrl,
        prompt: shot.action,
        durationSec: Math.max(1, Math.ceil(shot.duration_ms / 1000)),
        intent,
        model_key: modelKeyForIntent(intent),
        providerHint: gen.providerName,
        credit_estimate: this.creditEstimateForShot(shot, 'cine_motion_final'),
      },
      idempotencyKey: key,
    });

    return { id: row.id, status: 'queued' };
  }

  async recordTakeScore(
    shotId: number,
    assetId: number,
    verdict: 'passed' | 'failed',
    artifactJson: Record<string, unknown>,
  ): Promise<VdTakeScoreRow> {
    assertCinematicEnabled(this.config);
    const shot = await this.requireShot(shotId);
    if (shot.status === 'blocked') throw new Error('invalid_body');

    const score = await this.takes.insertScore({
      asset_id: assetId,
      shot_id: shotId,
      verdict,
      artifact_json: artifactJson,
    });

    if (verdict === 'failed') {
      await this.recordTakeFail(shotId);
    }

    return score;
  }

  async recordTakeFail(shotId: number): Promise<VdShotRow> {
    const shot = await this.requireShot(shotId);
    const next = shot.take_fail_count + 1;
    await this.shots.incrementTakeFailCount(shotId, next);
    if (next >= 5) {
      await this.shots.updateStatus(shotId, 'blocked');
    }
    const updated = await this.shots.getById(shotId);
    if (!updated) throw new Error('vd_shot_not_found');
    return updated;
  }

  async selectTake(shotId: number, assetId: number): Promise<VdShotRow> {
    assertCinematicEnabled(this.config);
    const shot = await this.requireShot(shotId);
    const projectId = await this.projectIdForShot(shot);
    const asset = await this.assets.getById(assetId);
    if (!asset || asset.project_id !== projectId || asset.kind !== 'take') {
      throw new Error('invalid_body');
    }
    const passed = await this.takes.hasPassedDraftForShot(shotId);
    if (!passed) throw new Error('take_draft_required');
    await this.shots.updateStatus(shotId, 'clip_selected');
    const updated = await this.shots.getById(shotId);
    if (!updated) throw new Error('vd_shot_not_found');
    return updated;
  }

  async listTakes(projectId: number): Promise<VdTakeView[]> {
    const project = await this.projects.getById(projectId);
    if (!project) throw new Error('vd_project_not_found');

    const takeAssets = await this.assets.listByProjectIdAndKind(projectId, 'take', 24);
    const scores = await this.takes.listByProjectId(projectId);
    const scoreByAsset = new Map(scores.map((row) => [row.asset_id, row]));

    return takeAssets.map((asset) => {
      const score = scoreByAsset.get(asset.id);
      return {
        asset_id: asset.id,
        shot_id: score?.shot_id ?? 0,
        url: asset.url || asset.storage_key || '',
        sha256: asset.sha256,
        duration_ms: asset.duration_ms,
        verdict: score?.verdict ?? null,
        artifact_json: score?.artifact_json ?? {},
      };
    });
  }
}
