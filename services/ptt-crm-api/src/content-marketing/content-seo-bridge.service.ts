import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SeoContentService } from '../seo-content/seo-content.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktBridgeSeoStatus, CmktItemRow } from './content-marketing.types';

const SEO_BRIDGE_STATUSES = new Set([
  'approved_internal',
  'scheduled',
  'published',
  'pending_client',
  'client_approved',
]);

@Injectable()
export class ContentSeoBridgeService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly seo: SeoContentService,
  ) {}

  private assertSeoEligible(item: CmktItemRow): void {
    if (item.channel !== 'website' || item.format !== 'blog') {
      throw new BadRequestException({
        error: 'seo_bridge_ineligible',
        message: 'SEO bridge chỉ áp dụng website/blog.',
      });
    }
    if (!SEO_BRIDGE_STATUSES.has(item.status)) {
      throw new BadRequestException({
        error: 'seo_bridge_status',
        message: 'Item phải được duyệt nội bộ trước khi bridge SEO.',
        status: item.status,
      });
    }
  }

  async bridgeSeo(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<{ ok: boolean; item: CmktItemRow; seo_content_id: number; href: string }> {
    const lc = await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    this.assertSeoEligible(item);

    if (item.seo_bridge_id) {
      const status = await this.getSeoStatus(item.seo_bridge_id);
      return {
        ok: true,
        item,
        seo_content_id: item.seo_bridge_id,
        href: status.href ?? `/seo/content/${item.seo_bridge_id}`,
      };
    }

    const customerId =
      lc.customer_id != null && lc.customer_id !== ''
        ? Number(lc.customer_id)
        : null;
    if (!customerId) {
      throw new BadRequestException({
        error: 'seo_client_required',
        message: 'Lifecycle cần customer_id để bridge SEO pipeline.',
      });
    }

    const markdown = String(item.body_json?.markdown ?? '').trim();
    const seoContent = await this.seo.createContent({
      customer_id: customerId,
      lifecycle_id: lifecycleId,
      title: item.title,
      content_type: 'blog',
      workflow_status: 'brief_ready',
      brief: {
        cmkt_item_id: item.id,
        funnel_goal: item.funnel_goal,
        hook: item.brief_json?.hook,
      },
      body_html: markdown ? `<pre>${markdown.replace(/</g, '&lt;')}</pre>` : '',
      actor_id: actorEmail,
    });

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      seo_bridge_id: seoContent.id,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'seo_bridge');

    return {
      ok: true,
      item: updated,
      seo_content_id: seoContent.id,
      href: `/seo/content/${seoContent.id}`,
    };
  }

  async getSeoBridgeStatus(
    lifecycleId: number,
    itemId: number,
  ): Promise<CmktBridgeSeoStatus> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!item.seo_bridge_id) {
      return { linked: false, seo_content_id: null, workflow_status: null, href: null };
    }
    return this.getSeoStatus(item.seo_bridge_id);
  }

  private async getSeoStatus(seoContentId: number): Promise<CmktBridgeSeoStatus> {
    try {
      const content = await this.seo.getContent(seoContentId);
      if (!content) {
        return {
          linked: true,
          seo_content_id: seoContentId,
          workflow_status: null,
          href: `/seo/content/${seoContentId}`,
        };
      }
      return {
        linked: true,
        seo_content_id: seoContentId,
        workflow_status: content.workflow_status,
        href: `/seo/content/${seoContentId}`,
      };
    } catch {
      return {
        linked: true,
        seo_content_id: seoContentId,
        workflow_status: null,
        href: `/seo/content/${seoContentId}`,
      };
    }
  }
}
