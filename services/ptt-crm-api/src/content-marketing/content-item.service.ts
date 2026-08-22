import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CONTENT_RESEARCH_BRIEF_KEY,
  stripContentResearchFromBrief,
} from '../market-research/content-insight-snapshot.util';
import { assertValidChannelFormat } from './content-marketing-channel.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { emptyBodyJson } from './content-marketing.util';
import { assertProductionGateForPublish } from './content-production.util';
import { assertVisualGateForPublish } from './content-media.util';
import { assertTransition, publishFromStatuses } from './content-workflow.util';
import { diffMarkdownLines } from './content-version-diff.util';
import type { CmktBodyJson, CmktIdeaRow, CmktItemRow, CmktItemVersionRow, CmktVersionComparePayload } from './content-marketing.types';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class ContentItemService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async listItems(
    lifecycleId: number,
    filters: { status?: string; format?: string; assignee?: number },
  ): Promise<{ items: CmktItemRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const items = await this.repo.listItems(lifecycleId, filters);
    return { items };
  }

  async getItem(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    return item;
  }

  async createItem(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const channel = String(body.channel ?? '').trim();
    const format = String(body.format ?? '').trim();
    assertValidChannelFormat(channel, format);
    const title = String(body.title ?? '').trim();
    if (!title) {
      throw new BadRequestException({ error: 'title_required' });
    }
    return this.repo.createItem(lifecycleId, {
      title,
      channel,
      format,
      funnel_goal: String(body.funnel_goal ?? '').trim(),
      idea_id: body.idea_id != null ? Number(body.idea_id) : null,
      brief_json: (body.brief_json as Record<string, unknown>) ?? {},
      body_json: (body.body_json as CmktBodyJson) ?? emptyBodyJson(),
      created_by: actorEmail,
    });
  }

  async createItemFromIdea(
    lifecycleId: number,
    idea: CmktIdeaRow,
    channel: string,
    format: string,
    actorEmail: string,
    opts?: { title?: string },
  ): Promise<CmktItemRow> {
    assertValidChannelFormat(channel, format);
    return this.repo.createItem(lifecycleId, {
      title: opts?.title?.trim() || idea.title,
      channel,
      format,
      funnel_goal: idea.target_goal,
      idea_id: idea.id,
      brief_json: { hook: idea.hook, ...(idea.meta_json ?? {}) },
      body_json: emptyBodyJson(),
      created_by: actorEmail,
    });
  }

  async patchItem(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (existing.status === 'published' || existing.status === 'archived') {
      throw new BadRequestException({ error: 'item_locked', status: existing.status });
    }

    const patch: Record<string, unknown> = {};
    if (body.title != null) patch.title = String(body.title).trim();
    if (body.funnel_goal != null) patch.funnel_goal = String(body.funnel_goal).trim();
    if (body.brief_json != null) {
      const stripped = stripContentResearchFromBrief(body.brief_json as Record<string, unknown>);
      const existingCite = (existing.brief_json ?? {})[CONTENT_RESEARCH_BRIEF_KEY];
      patch.brief_json =
        existingCite !== undefined
          ? { ...stripped, [CONTENT_RESEARCH_BRIEF_KEY]: existingCite }
          : stripped;
    }
    if (body.selected_variant_idx != null) {
      patch.selected_variant_idx = Number(body.selected_variant_idx);
    }
    if (body.channel != null || body.format != null) {
      const channel = String(body.channel ?? existing.channel);
      const format = String(body.format ?? existing.format);
      assertValidChannelFormat(channel, format);
      patch.channel = channel;
      patch.format = format;
    }

    let versionReason: string | null = null;
    if (body.apply_variant === true && body.selected_variant_idx != null) {
      const idx = Number(body.selected_variant_idx);
      const variants = existing.body_json?.variants ?? [];
      if (idx < 0 || idx >= variants.length) {
        throw new BadRequestException({ error: 'invalid_variant_idx', idx, count: variants.length });
      }
      const hook = variants[idx];
      const rest = String(existing.body_json?.markdown ?? '').trim();
      patch.body_json = {
        ...existing.body_json,
        markdown: rest ? `${hook}\n\n${rest}` : hook,
        variants,
        html: existing.body_json?.html ?? '',
      };
      patch.selected_variant_idx = idx;
      versionReason = 'manual';
    } else if (body.body_json != null) {
      patch.body_json = body.body_json as CmktBodyJson;
      versionReason = 'manual';
    }

    const updated = await this.repo.patchItem(lifecycleId, itemId, patch);
    if (versionReason) {
      await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, versionReason);
    }
    return updated;
  }

  async patchItemAssignees(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const existing = await this.repo.getItemById(lifecycleId, itemId);
    if (!existing) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (existing.status === 'published' || existing.status === 'archived') {
      throw new BadRequestException({ error: 'item_locked', status: existing.status });
    }

    const patch: Record<string, unknown> = {};
    if ('assignee_sp' in body) {
      patch.assignee_sp = await this.parseAssigneeId(body.assignee_sp);
    }
    if ('assignee_qa' in body) {
      patch.assignee_qa = await this.parseAssigneeId(body.assignee_qa);
    }
    if (!Object.keys(patch).length) {
      throw new BadRequestException({ error: 'assignee_required', message: 'Cần assignee_sp hoặc assignee_qa.' });
    }
    return this.repo.patchItem(lifecycleId, itemId, patch);
  }

  async compareItemVersions(
    lifecycleId: number,
    itemId: number,
    v1: number,
    v2: number,
  ): Promise<CmktVersionComparePayload> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    if (!Number.isFinite(v1) || !Number.isFinite(v2) || v1 <= 0 || v2 <= 0) {
      throw new BadRequestException({ error: 'invalid_version', v1, v2 });
    }

    const [versionA, versionB] = await Promise.all([
      this.repo.getItemVersionByNo(itemId, v1),
      this.repo.getItemVersionByNo(itemId, v2),
    ]);
    if (!versionA || !versionB) {
      throw new NotFoundException({ error: 'version_not_found', v1, v2 });
    }

    const before = String(versionA.body_json?.markdown ?? '');
    const after = String(versionB.body_json?.markdown ?? '');
    const diff = diffMarkdownLines(before, after);
    return { item_id: itemId, v1, v2, lines: diff.lines };
  }

  private async parseAssigneeId(value: unknown): Promise<number | null> {
    if (value == null || value === '') return null;
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) {
      throw new BadRequestException({ error: 'invalid_assignee', value });
    }
    if (!(await this.repo.staffExists(id))) {
      throw new BadRequestException({ error: 'assignee_not_found', id });
    }
    return id;
  }

  async listItemVersions(lifecycleId: number, itemId: number): Promise<{ versions: CmktItemVersionRow[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }
    const versions = await this.repo.listItemVersions(itemId);
    return { versions };
  }

  async publishItem(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) {
      throw new NotFoundException({ error: 'item_not_found', id: itemId });
    }

    assertTransition(item.status, publishFromStatuses(this.config.contentMarketingClientGate), 'publish');
    assertProductionGateForPublish(item);
    assertVisualGateForPublish(item, this.config.contentMarketingMediaEnabled);

    const publishedUrl = body.published_url != null ? String(body.published_url).trim() : null;
    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      status: 'published',
      published_at: new Date().toISOString(),
      published_url: publishedUrl || item.published_url,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'publish');
    return updated;
  }
}
