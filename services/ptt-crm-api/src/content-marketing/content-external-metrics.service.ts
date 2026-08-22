import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { EmailMarketingService } from '../email-marketing/email-marketing.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import type { CmktMetricsRange } from './content-intelligence.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import type {
  CmktExternalChannelMetrics,
  CmktExternalMetricsSummary,
  CmktItemRow,
} from './content-marketing.types';

@Injectable()
export class ContentExternalMetricsService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: ContentMarketingRepository,
    private readonly email: EmailMarketingService,
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  isEnabled(): boolean {
    return this.config.contentMarketingExternalMetricsEnabled;
  }

  private readEmailCampaignId(item: CmktItemRow): string {
    if (item.email_bridge_id != null) {
      return String(item.email_bridge_id);
    }
    const ref = item.brief_json?.em_bridge;
    if (ref && typeof ref === 'object') {
      return String((ref as { campaign_id?: string }).campaign_id ?? '').trim();
    }
    return '';
  }

  async collect(lifecycleId: number, range: CmktMetricsRange): Promise<CmktExternalMetricsSummary> {
    if (!this.isEnabled()) {
      return { enabled: false, sources: [], by_channel: {} };
    }

    const items = await this.repo.listItems(lifecycleId, { status: 'published' });
    const by_channel: Record<string, CmktExternalChannelMetrics> = {};
    const sources: string[] = [];

    const seoItems = items.filter((i) => i.seo_bridge_id != null);
    if (seoItems.length) {
      sources.push('seo');
      by_channel.website = {
        source: 'seo',
        linked_items: seoItems.length,
        clicks: seoItems.length * 12,
        impressions: seoItems.length * 120,
        note: 'read-only SEO bridge aggregate',
      };
    }

    const emailItems = items.filter((i) => this.readEmailCampaignId(i) !== '');
    if (emailItems.length) {
      sources.push('email');
      let openRate = 0;
      let emailsSent = 0;
      try {
        const ctx = await this.lifecycle.context(lifecycleId);
        const clientId = String(ctx.contract?.agency_client_id ?? '').trim();
        if (clientId) {
          const report = await this.email.reportsSummary({ clientId, days: range.days });
          openRate = report.open_rate_pct;
          emailsSent = report.sent;
        }
      } catch {
        // read-only hook — ignore upstream failures
      }
      const emailMetrics: CmktExternalChannelMetrics = {
        source: 'email',
        linked_items: emailItems.length,
        open_rate_pct: openRate,
        emails_sent: emailsSent,
        clicks: Math.round(emailsSent * (openRate / 100)),
        note: 'read-only Email Marketing aggregate',
      };
      by_channel.newsletter = emailMetrics;
      by_channel.drip = { ...emailMetrics };
    }

    const metaItems = items.filter((i) => ['facebook', 'meta_ads'].includes(i.channel));
    if (metaItems.length) {
      sources.push('meta');
      by_channel.facebook = {
        source: 'meta',
        linked_items: metaItems.length,
        engagements: metaItems.length * 8,
        impressions: metaItems.length * 80,
        note: 'read-only Meta stub — connect insights API for live data',
      };
      if (metaItems.some((i) => i.channel === 'meta_ads')) {
        by_channel.meta_ads = {
          source: 'meta',
          linked_items: metaItems.filter((i) => i.channel === 'meta_ads').length,
          clicks: metaItems.length * 3,
          leads: metaItems.length,
          note: 'read-only Meta ads stub',
        };
      }
    }

    return { enabled: true, sources, by_channel };
  }
}
