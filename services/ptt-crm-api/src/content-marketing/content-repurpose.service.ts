import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import {
  assertRepurposeSource,
  normalizeRepurposeCount,
  resolveRepurposeTransform,
} from './content-repurpose.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type {
  CmktDerivationRow,
  CmktItemRow,
  CmktJobRow,
  CmktRepurposeResult,
  CmktRepurposeTarget,
} from './content-marketing.types';

@Injectable()
export class ContentRepurposeService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly worker: ContentJobWorkerService,
  ) {}

  private ensureAiEnabled(): void {
    if (!this.config.contentMarketingAiEnabled) {
      throw new BadRequestException({
        error: 'cmkt_ai_disabled',
        message: 'Bật PTT_CONTENT_MARKETING_AI_ENABLED=1 để dùng repurpose.',
      });
    }
  }

  async repurpose(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktRepurposeResult> {
    this.ensureAiEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);

    const source = await this.repo.getItemById(lifecycleId, itemId);
    if (!source) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    assertRepurposeSource(source);

    const rawTargets = body.targets;
    if (!Array.isArray(rawTargets) || rawTargets.length === 0) {
      throw new BadRequestException({ error: 'targets_required', message: 'Cần ít nhất 1 target.' });
    }

    const optimizeHooks = body.optimize_hooks !== false;
    const derivedItems: CmktItemRow[] = [];
    const derivations: CmktDerivationRow[] = [];
    const jobs: CmktJobRow[] = [];

    for (const raw of rawTargets as CmktRepurposeTarget[]) {
      const transform = resolveRepurposeTransform(source, raw);
      const count = normalizeRepurposeCount(raw.count);
      for (let i = 0; i < count; i++) {
        const suffix = count > 1 ? ` (${i + 1}/${count})` : '';
        const derived = await this.repo.createDerivedItem(lifecycleId, {
          parent_item_id: source.id,
          title: `${source.title} — ${transform.label}${suffix}`,
          channel: transform.target.channel,
          format: transform.target.format,
          funnel_goal: source.funnel_goal,
          brief_json: {
            repurpose_from: source.id,
            transform_type: transform.transform_type,
            hook: source.brief_json?.hook,
          },
          created_by: actorEmail,
        });
        const derivation = await this.repo.insertDerivation({
          source_item_id: source.id,
          derived_item_id: derived.id,
          transform_type: transform.transform_type,
          prompt_profile: transform.prompt_profile,
        });
        const job = await this.repo.createContentJob({
          lifecycle_id: lifecycleId,
          item_id: derived.id,
          job_type: 'repurpose',
          input_json: {
            source_item_id: source.id,
            transform_type: transform.transform_type,
            prompt_profile: transform.prompt_profile,
            optimize_hooks: optimizeHooks,
            target_channel: transform.target.channel,
            target_format: transform.target.format,
          },
          created_by: actorEmail,
        });
        const finished = await this.worker.processJob(job.id);
        derivedItems.push((await this.repo.getItemById(lifecycleId, derived.id)) ?? derived);
        derivations.push(derivation);
        jobs.push(finished ?? job);
      }
    }

    return {
      ok: true,
      source_item_id: source.id,
      derived_items: derivedItems,
      derivations,
      jobs,
    };
  }

  async listDerivations(
    lifecycleId: number,
    itemId: number,
  ): Promise<{ derivations: CmktDerivationRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    const derivations = await this.repo.listDerivations(lifecycleId, itemId);
    return { derivations };
  }
}
