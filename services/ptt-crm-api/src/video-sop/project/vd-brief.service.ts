import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { assertStageTransition, type VdProjectStage } from '../rules/vd-stage.guard';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdProjectRepository } from './vd-project.repository';

export const BRIEF_KEYS = [
  'objective', 'audience', 'offer', 'duration_sec', 'platform', 'tone', 'constraints', 'insight_ids',
] as const;

const PLATFORMS = new Set(['reels', 'shorts', 'feed_square']);

export type VdBriefResponse = {
  project_id: number;
  body_json: Record<string, unknown>;
  stage: VdProjectStage;
};

function trimLen(value: unknown): number {
  return typeof value === 'string' ? value.trim().length : 0;
}

export function assertBriefComplete(body: Record<string, unknown>): void {
  const textOk =
    trimLen(body.objective) >= 8 &&
    trimLen(body.audience) >= 8 &&
    trimLen(body.offer) >= 8 &&
    trimLen(body.constraints) >= 8 &&
    trimLen(body.tone) >= 4;
  const duration = body.duration_sec;
  const durationOk =
    typeof duration === 'number' && Number.isFinite(duration) && duration >= 15 && duration <= 60;
  const platformOk = typeof body.platform === 'string' && PLATFORMS.has(body.platform);
  const ids = body.insight_ids;
  const insightsOk =
    Array.isArray(ids) && ids.every((id) => typeof id === 'number' && Number.isFinite(id));
  if (!textOk || !durationOk || !platformOk || !insightsOk) {
    throw new Error('brief_incomplete');
  }
}

function pickBriefBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of BRIEF_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}

@Injectable()
export class VdBriefService {
  constructor(
    private readonly config: AppConfigService,
    readonly repo: VdProjectRepository,
  ) {}

  private async requireProject(id: number) {
    const row = await this.repo.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }

  async get(id: number): Promise<VdBriefResponse> {
    const project = await this.requireProject(id);
    const body_json = (await this.repo.getBrief(id)) ?? {};
    return { project_id: project.id, body_json, stage: project.stage };
  }

  async save(id: number, body: Record<string, unknown>): Promise<VdBriefResponse> {
    assertCinematicEnabled(this.config);
    if (body == null || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid_body');
    }
    const project = await this.requireProject(id);
    const body_json = pickBriefBody(body);
    await this.repo.upsertBrief(id, body_json);
    return { project_id: project.id, body_json, stage: project.stage };
  }

  async markReady(id: number): Promise<VdBriefResponse> {
    assertCinematicEnabled(this.config);
    const project = await this.requireProject(id);
    const body_json = (await this.repo.getBrief(id)) ?? {};
    assertBriefComplete(body_json);
    assertStageTransition(project.stage, 'brief_ready');
    await this.repo.updateStage(id, 'brief_ready');
    return { project_id: project.id, body_json, stage: 'brief_ready' };
  }

  async listInsights(): Promise<{ items: Array<{ id: number; title: string }> }> {
    try {
      const items = await this.repo.listApprovedInsights();
      return { items };
    } catch {
      return { items: [] };
    }
  }
}
