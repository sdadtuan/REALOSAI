import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentMediaCleanService } from './content-media-clean.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { itemNeedsVisualApproval, mergeMediaJson } from './content-media.util';
import { mergeProductionJson } from './content-production.util';
import type { CmktItemRow, CmktVisualReviewItem } from './content-marketing.types';

const VISUAL_REVIEW_STATUSES = new Set(['approved_internal', 'scheduled', 'client_approved']);

@Injectable()
export class ContentVisualService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly mediaClean: ContentMediaCleanService,
  ) {}

  async listVisualReviewQueue(
    lifecycleId: number,
  ): Promise<{ items: CmktVisualReviewItem[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const items = await this.repo.listVisualReviewQueue(lifecycleId);
    return { items };
  }

  async submitVisualReview(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const item = await this.getVisualItem(lifecycleId, itemId);
    if (item.visual_status !== 'ai_ready' && item.visual_status !== 'rejected') {
      throw new BadRequestException({
        error: 'visual_submit_invalid',
        visual_status: item.visual_status,
        message: 'Chỉ submit visual khi ai_ready hoặc rejected.',
      });
    }
    const assets = item.media_json?.ai_assets?.length || item.media_json?.carousel_slides?.length;
    if (!assets) {
      throw new BadRequestException({ error: 'visual_assets_required' });
    }
    const updated = await this.repo.patchItem(lifecycleId, itemId, { visual_status: 'ai_ready' });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'visual_submit');
    return updated;
  }

  async approveVisual(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const item = await this.getVisualItem(lifecycleId, itemId);
    if (!['ai_ready', 'human_polish'].includes(item.visual_status)) {
      throw new BadRequestException({
        error: 'visual_approve_invalid',
        visual_status: item.visual_status,
      });
    }
    const isSocialVideo =
      item.media_json?.video_studio === 'social' || item.media_json?.video_qa != null;
    if (isSocialVideo) {
      if (item.media_json?.video_qa?.blocked === true && body.override !== true) {
        throw new BadRequestException({
          error: 'video_qa_blocked',
          message: 'video_qa_blocked',
        });
      }
    } else {
      const score = item.media_json?.visual_qa?.score;
      if (score != null && score < 50 && body.override !== true) {
        throw new BadRequestException({
          error: 'visual_qa_blocked',
          score,
          message: 'Visual QA score <50 — cần override=true hoặc regenerate.',
        });
      }
    }

    const score = item.media_json?.visual_qa?.score;
    const media = mergeMediaJson(item.media_json, {
      visual_qa: {
        ...(item.media_json?.visual_qa ?? { score: score ?? 0 }),
        notes: body.comment != null ? String(body.comment) : item.media_json?.visual_qa?.notes,
      },
    });

    const promotedMedia = await this.mediaClean.promoteMediaJson(media, lifecycleId, itemId);

    let production_json = item.production_json;
    if (item.format === 'carousel' || itemNeedsVisualApproval(item)) {
      production_json = mergeProductionJson(item.production_json, { phase: 'done' });
    }

    const selected = promotedMedia.selected_asset_id
      ? [...(promotedMedia.ai_assets ?? []), ...(promotedMedia.carousel_slides ?? [])].find(
          (a) => a.id === promotedMedia.selected_asset_id,
        )
      : [...(promotedMedia.ai_assets ?? []), ...(promotedMedia.carousel_slides ?? [])].find((a) => a.selected);

    if (selected?.url) {
      production_json = mergeProductionJson(production_json, {
        asset_urls: [...(production_json.asset_urls ?? []), selected.url],
      });
    }

    if (promotedMedia.video_short?.url) {
      production_json = mergeProductionJson(production_json, {
        final_video_url: promotedMedia.video_short.url,
      });
    }

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      visual_status: 'approved',
      media_json: promotedMedia,
      production_json,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'visual_approve');
    return updated;
  }

  async rejectVisual(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const item = await this.getVisualItem(lifecycleId, itemId);
    const comment = String(body.comment ?? body.reason ?? '').trim();
    if (comment.length < 10) {
      throw new BadRequestException({
        error: 'visual_reject_comment_required',
        min_length: 10,
      });
    }
    const updated = await this.repo.patchItem(lifecycleId, itemId, { visual_status: 'rejected' });
    await this.repo.insertItemComment({
      item_id: itemId,
      author_id: actorEmail,
      body: comment,
      visibility: 'internal',
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'visual_reject');
    return updated;
  }

  async escalateHuman(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const item = await this.getVisualItem(lifecycleId, itemId);
    const production_json = mergeProductionJson(item.production_json, {
      escalate_human: true,
      phase: item.format === 'video_script' ? 'awaiting_video' : 'awaiting_design',
      notes: body.notes != null ? String(body.notes) : item.production_json?.notes,
    });
    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      visual_status: 'human_polish',
      production_json,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'visual_escalate');
    return updated;
  }

  private async getVisualItem(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!VISUAL_REVIEW_STATUSES.has(item.status) && item.status !== 'published') {
      throw new BadRequestException({
        error: 'visual_copy_not_ready',
        status: item.status,
      });
    }
    if (!itemNeedsVisualApproval(item)) {
      throw new BadRequestException({ error: 'visual_not_required', format: item.format });
    }
    return item;
  }
}
