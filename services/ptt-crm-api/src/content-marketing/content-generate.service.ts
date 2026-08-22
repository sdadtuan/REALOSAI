import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { assessBriefReadiness } from './content-brief-readiness.util';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktGenerateInput, CmktRegenerateInput } from './content-marketing-prompt.util';
import type { CmktJobRow } from './content-marketing.types';

const GENERATABLE_STATUSES = new Set(['draft', 'changes_requested']);

@Injectable()
export class ContentGenerateService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly brandContext: ContentBrandContextService,
    private readonly repo: ContentMarketingRepository,
    private readonly worker: ContentJobWorkerService,
  ) {}

  private ensureAiEnabled(): void {
    if (!this.config.contentMarketingAiEnabled) {
      throw new BadRequestException({
        error: 'cmkt_ai_disabled',
        message: 'Bật PTT_CONTENT_MARKETING_AI_ENABLED=1 để dùng AI generate.',
      });
    }
  }

  private async assertBriefReady(
    lifecycleId: number,
    item: { funnel_goal?: string | null; brief_json?: Record<string, unknown> | null },
    inputGoal?: string | null,
  ): Promise<void> {
    if (!this.config.contentMarketingBriefGateEnabled) return;
    const brand = await this.brandContext.resolveForLifecycle(lifecycleId);
    const readiness = assessBriefReadiness(item, brand, inputGoal);
    if (!readiness.ok) {
      throw new BadRequestException({
        error: 'brief_incomplete',
        message: 'Brief thiếu audience hoặc goal — bổ sung trước khi generate.',
        missing_fields: readiness.missing_fields,
      });
    }
  }

  async startDraftJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startJob(lifecycleId, itemId, 'draft_generate', body, actorEmail);
  }

  async startVariantsJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    return this.startJob(lifecycleId, itemId, 'variant_generate', body, actorEmail);
  }

  async startRegenerateJob(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    this.ensureAiEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);

    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!GENERATABLE_STATUSES.has(item.status)) {
      throw new BadRequestException({ error: 'item_not_generatable', status: item.status });
    }

    const existingMarkdown = String(item.body_json?.markdown ?? '').trim();
    if (!existingMarkdown) {
      throw new BadRequestException({
        error: 'regenerate_body_required',
        message: 'Cần nội dung draft trước khi regenerate — dùng Generate draft.',
      });
    }

    const input: CmktRegenerateInput & Record<string, unknown> = {
      tone: (body.tone as CmktRegenerateInput['tone']) ?? 'professional_friendly',
      length: (body.length as CmktRegenerateInput['length']) ?? 'medium',
      goal: body.goal != null ? String(body.goal) : item.funnel_goal,
      include_outline: body.include_outline !== false,
      mode: body.mode === 'refresh' ? 'refresh' : 'rewrite',
      reason: body.reason != null ? String(body.reason).slice(0, 500) : undefined,
      channel: body.channel != null ? String(body.channel) : item.channel,
      format: body.format != null ? String(body.format) : item.format,
    };

    await this.assertBriefReady(lifecycleId, item, input.goal);

    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      job_type: 'regenerate',
      input_json: input,
      created_by: actorEmail,
    });

    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  private async startJob(
    lifecycleId: number,
    itemId: number,
    jobType: 'draft_generate' | 'variant_generate',
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    this.ensureAiEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);

    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!GENERATABLE_STATUSES.has(item.status)) {
      throw new BadRequestException({ error: 'item_not_generatable', status: item.status });
    }

    const input: CmktGenerateInput & Record<string, unknown> = {
      tone: (body.tone as CmktGenerateInput['tone']) ?? 'professional_friendly',
      length: (body.length as CmktGenerateInput['length']) ?? 'medium',
      goal: body.goal != null ? String(body.goal) : item.funnel_goal,
      include_outline: body.include_outline !== false,
      variant_count: body.variant_count != null ? Number(body.variant_count) : 3,
      channel: body.channel != null ? String(body.channel) : item.channel,
      format: body.format != null ? String(body.format) : item.format,
    };

    await this.assertBriefReady(lifecycleId, item, input.goal);

    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: itemId,
      job_type: jobType,
      input_json: input,
      created_by: actorEmail,
    });

    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async getJob(lifecycleId: number, jobId: number): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const job = await this.repo.getContentJob(lifecycleId, jobId);
    if (!job) throw new NotFoundException({ error: 'job_not_found', id: jobId });
    return job;
  }

  async cancelJob(lifecycleId: number, jobId: number): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const job = await this.repo.cancelContentJob(lifecycleId, jobId);
    if (!job) {
      throw new ConflictException({ error: 'job_not_cancellable', id: jobId });
    }
    return job;
  }
}
