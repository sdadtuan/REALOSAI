import { Injectable, NotFoundException } from '@nestjs/common';
import { SeoContentService } from '../seo-content/seo-content.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import type { CmktBridgeSeoStatus, CmktItemRow } from './content-marketing.types';

const PUBLISHED_SEO_STATUSES = new Set(['published', 'monitoring']);

@Injectable()
export class ContentSeoBridgeSyncService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly seo: SeoContentService,
  ) {}

  buildPublishedUrlFromSeo(slug: string): string {
    const clean = slug.trim().replace(/^\/+/, '');
    if (!clean) return '';
    if (/^https?:\/\//i.test(clean)) return clean;
    return `/blog/${clean}`;
  }

  async syncPublishedUrlFromSeo(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<{ synced: boolean; item: CmktItemRow; published_url?: string }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });
    if (!item.seo_bridge_id) {
      return { synced: false, item };
    }

    const content = await this.seo.getContent(item.seo_bridge_id);
    if (!content || !PUBLISHED_SEO_STATUSES.has(content.workflow_status)) {
      return { synced: false, item };
    }

    const publishedUrl = this.buildPublishedUrlFromSeo(content.slug || String(content.id));
    if (!publishedUrl || item.published_url === publishedUrl) {
      return { synced: false, item, published_url: item.published_url ?? undefined };
    }

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      published_url: publishedUrl,
      status: item.status === 'published' ? item.status : 'scheduled',
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'seo_url_sync');
    return { synced: true, item: updated, published_url: publishedUrl };
  }

  async getSeoBridgeStatusWithSync(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktBridgeSeoStatus & { published_url_synced?: boolean }> {
    const sync = await this.syncPublishedUrlFromSeo(lifecycleId, itemId, actorEmail);
    const item = sync.item;
    if (!item.seo_bridge_id) {
      return { linked: false, seo_content_id: null, workflow_status: null, href: null };
    }
    try {
      const content = await this.seo.getContent(item.seo_bridge_id);
      return {
        linked: true,
        seo_content_id: item.seo_bridge_id,
        workflow_status: content?.workflow_status ?? null,
        href: `/seo/content/${item.seo_bridge_id}`,
        published_url_synced: sync.synced,
      };
    } catch {
      return {
        linked: true,
        seo_content_id: item.seo_bridge_id,
        workflow_status: null,
        href: `/seo/content/${item.seo_bridge_id}`,
        published_url_synced: sync.synced,
      };
    }
  }
}
