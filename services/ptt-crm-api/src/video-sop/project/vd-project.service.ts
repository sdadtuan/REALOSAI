import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { assertCinematicEnabled } from '../video-sop-flags';
import { assertStageTransition } from '../rules/vd-stage.guard';
import { VdProjectRepository } from './vd-project.repository';
import type { CreateFromContentItemInput, VdProjectRow } from '../video-sop.types';

function isUniqueViolation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '23505');
}

@Injectable()
export class VdProjectService {
  constructor(
    private readonly config: AppConfigService,
    readonly repo: VdProjectRepository,
  ) {}

  async createFromContentItem(input: CreateFromContentItemInput): Promise<VdProjectRow> {
    assertCinematicEnabled(this.config);

    const existing = await this.repo.findByCmktItemId(input.itemId);
    if (existing) return existing;

    const today = await this.repo.countCreatedToday(input.lifecycleId);
    if (today >= this.config.contentMarketingVideoCinematicDailyCap) {
      throw new Error('video_cinematic_daily_cap');
    }

    assertStageTransition('brief_draft', 'brief_draft');

    try {
      return await this.repo.withTransaction(async () => {
        const row = await this.repo.insertProject({
          lifecycle_id: input.lifecycleId,
          client_id: input.clientId ?? null,
          cmkt_item_id: input.itemId,
          title: input.title,
          stage: 'brief_draft',
          status: 'active',
          created_by: input.email,
        });
        await this.repo.insertBrief(row.id, {});
        await this.repo.insertScript(row.id, 1, input.scriptMarkdown);
        await this.repo.insertAudit(row.id, input.email, 'project.created', {
          cmkt_item_id: input.itemId,
          lifecycle_id: input.lifecycleId,
        });
        return row;
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        const found = await this.repo.findByCmktItemId(input.itemId);
        if (found) return found;
      }
      throw err;
    }
  }

  async listByLifecycle(lifecycleId: number): Promise<VdProjectRow[]> {
    return this.repo.listByLifecycle(lifecycleId);
  }

  async getById(id: number): Promise<VdProjectRow> {
    const row = await this.repo.getById(id);
    if (!row) throw new Error('vd_project_not_found');
    return row;
  }
}
