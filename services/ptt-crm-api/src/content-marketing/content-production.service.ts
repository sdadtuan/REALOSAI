import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  buildDesignBriefMarkdown,
  buildScriptExportMarkdown,
  defaultProductionPhase,
  itemNeedsProduction,
  mergeProductionJson,
} from './content-production.util';
import {
  designBriefPdfBuffer,
  designBriefPdfFilename,
} from './content-production-export.util';
import type { CmktItemRow, CmktProductionJson } from './content-marketing.types';

const PRODUCTION_EDIT_STATUSES = new Set([
  'approved_internal',
  'scheduled',
  'pending_client',
  'client_approved',
]);

@Injectable()
export class ContentProductionService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  async getProduction(lifecycleId: number, itemId: number): Promise<{ production_json: CmktProductionJson }> {
    const item = await this.getEditableItem(lifecycleId, itemId);
    return { production_json: item.production_json ?? { phase: defaultProductionPhase(item) } };
  }

  async patchProduction(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const item = await this.getEditableItem(lifecycleId, itemId);
    const merged = mergeProductionJson(item.production_json, body);
    const updated = await this.repo.patchItem(lifecycleId, itemId, { production_json: merged });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'production_update');
    return updated;
  }

  async markProductionDone(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const item = await this.getEditableItem(lifecycleId, itemId);
    if (!itemNeedsProduction(item)) {
      throw new BadRequestException({
        error: 'production_not_required',
        message: 'Item này không yêu cầu production handoff.',
      });
    }
    const merged = mergeProductionJson(item.production_json, { phase: 'done' });
    const updated = await this.repo.patchItem(lifecycleId, itemId, { production_json: merged });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'production_done');
    return updated;
  }

  async linkCreative(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    const creativeId = String(body.creative_id ?? '').trim();
    if (!creativeId) {
      throw new BadRequestException({ error: 'creative_id_required' });
    }
    return this.patchProduction(lifecycleId, itemId, { creative_id: creativeId }, actorEmail);
  }

  async exportDesignBrief(
    lifecycleId: number,
    itemId: number,
  ): Promise<{ ok: boolean; filename: string; content: string; content_type: string }> {
    const item = await this.getEditableItem(lifecycleId, itemId);
    return {
      ok: true,
      filename: `creative-brief-${itemId}.md`,
      content: buildDesignBriefMarkdown(item),
      content_type: 'text/markdown',
    };
  }

  async exportDesignBriefPdf(
    lifecycleId: number,
    itemId: number,
  ): Promise<{ ok: boolean; filename: string; content_base64: string; content_type: string }> {
    const item = await this.getEditableItem(lifecycleId, itemId);
    const buffer = designBriefPdfBuffer(item);
    return {
      ok: true,
      filename: designBriefPdfFilename(itemId),
      content_base64: buffer.toString('base64'),
      content_type: 'application/pdf',
    };
  }

  async exportScript(
    lifecycleId: number,
    itemId: number,
  ): Promise<{ ok: boolean; filename: string; content: string; content_type: string }> {
    const item = await this.getEditableItem(lifecycleId, itemId);
    if (item.format !== 'video_script') {
      throw new BadRequestException({
        error: 'export_script_invalid_format',
        message: 'Export script chỉ áp dụng video_script.',
      });
    }
    return {
      ok: true,
      filename: `video-script-${itemId}.md`,
      content: buildScriptExportMarkdown(item),
      content_type: 'text/markdown',
    };
  }

  async initProductionOnApprove(lifecycleId: number, itemId: number): Promise<void> {
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item || !itemNeedsProduction(item)) return;
    const phase = defaultProductionPhase(item);
    if (item.production_json?.phase && item.production_json.phase !== 'none') return;
    await this.repo.patchItem(lifecycleId, itemId, {
      production_json: { ...(item.production_json ?? {}), phase },
    });
  }

  private async getEditableItem(lifecycleId: number, itemId: number): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!PRODUCTION_EDIT_STATUSES.has(item.status)) {
      throw new BadRequestException({
        error: 'production_status',
        message: 'Production handoff chỉ sau khi copy/script được duyệt.',
        status: item.status,
      });
    }
    return item;
  }
}
