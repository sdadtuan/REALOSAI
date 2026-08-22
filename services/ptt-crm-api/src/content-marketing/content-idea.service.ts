import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { CMKT_IDEA_STATUSES } from './content-marketing.constants';
import { assertValidChannelFormat } from './content-marketing-channel.util';
import { ContentItemService } from './content-item.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktIdeaRow, CmktItemRow, CmktJobRow } from './content-marketing.types';

@Injectable()
export class ContentIdeaService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly worker: ContentJobWorkerService,
    @Inject(forwardRef(() => ContentItemService))
    private readonly items: ContentItemService,
  ) {}

  async listIdeas(
    lifecycleId: number,
    filters: { status?: string; pillar_id?: number },
  ): Promise<{ ideas: CmktIdeaRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const ideas = await this.repo.listIdeas(lifecycleId, filters);
    return { ideas };
  }

  async createIdea(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktIdeaRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'title_required' });
    }
    const status = String(body.status ?? 'backlog');
    if (!CMKT_IDEA_STATUSES.includes(status as (typeof CMKT_IDEA_STATUSES)[number])) {
      throw new BadRequestException({ error: 'invalid_idea_status', status });
    }
    return this.repo.createIdea(lifecycleId, {
      title,
      hook: String(body.hook ?? '').trim(),
      target_goal: String(body.target_goal ?? '').trim(),
      channel_hints: Array.isArray(body.channel_hints)
        ? body.channel_hints.map((v) => String(v))
        : [],
      pillar_id: body.pillar_id != null ? Number(body.pillar_id) : null,
      status,
      meta_json: (body.meta_json as Record<string, unknown>) ?? {},
      source: 'manual',
      created_by: actorEmail,
    });
  }

  async patchIdea(
    lifecycleId: number,
    ideaId: number,
    body: Record<string, unknown>,
  ): Promise<CmktIdeaRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getIdeaById(lifecycleId, ideaId);
    if (!existing) {
      throw new NotFoundException({ error: 'idea_not_found', id: ideaId });
    }
    if (existing.status === 'converted') {
      throw new BadRequestException({ error: 'idea_already_converted', id: ideaId });
    }
    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = String(body.title).trim();
    if (body.hook != null) patch.hook = String(body.hook).trim();
    if (body.target_goal != null) patch.target_goal = String(body.target_goal).trim();
    if (body.status != null) {
      const status = String(body.status);
      if (!CMKT_IDEA_STATUSES.includes(status as (typeof CMKT_IDEA_STATUSES)[number])) {
        throw new BadRequestException({ error: 'invalid_idea_status', status });
      }
      patch.status = status;
    }
    if (body.channel_hints != null) {
      patch.channel_hints = Array.isArray(body.channel_hints)
        ? body.channel_hints.map((v) => String(v))
        : [];
    }
    if (body.meta_json != null) patch.meta_json = body.meta_json;
    return this.repo.patchIdea(lifecycleId, ideaId, patch);
  }

  async convertIdea(
    lifecycleId: number,
    ideaId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<{ idea: CmktIdeaRow; item: CmktItemRow }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const idea = await this.repo.getIdeaById(lifecycleId, ideaId);
    if (!idea) {
      throw new NotFoundException({ error: 'idea_not_found', id: ideaId });
    }
    if (idea.status === 'converted') {
      throw new BadRequestException({ error: 'idea_already_converted', id: ideaId });
    }
    const channel = String(body.channel ?? '').trim();
    const format = String(body.format ?? '').trim();
    assertValidChannelFormat(channel, format);

    const item = await this.items.createItemFromIdea(lifecycleId, idea, channel, format, actorEmail, {
      title: body.title != null ? String(body.title).trim() : undefined,
    });
    const updatedIdea = await this.repo.patchIdea(lifecycleId, ideaId, { status: 'converted' });
    return { idea: updatedIdea, item };
  }

  async startBulkIdeasJob(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    if (!this.config.contentMarketingAiEnabled) {
      throw new BadRequestException({
        error: 'cmkt_ai_disabled',
        message: 'Bật PTT_CONTENT_MARKETING_AI_ENABLED=1 để dùng AI ideas.',
      });
    }
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const ideaCount = Math.min(Math.max(Number(body.idea_count ?? 30), 10), 40);
    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: null,
      job_type: 'ideas_bulk',
      input_json: {
        idea_count: ideaCount,
        month_label: body.month_label != null ? String(body.month_label) : undefined,
      },
      created_by: actorEmail,
    });
    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }
}
