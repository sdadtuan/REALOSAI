import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentMarketingRepository } from '../content-marketing/content-marketing.repository';
import { ContentMarketingService } from '../content-marketing/content-marketing.service';
import { ContentWorkflowService } from '../content-marketing/content-workflow.service';
import { PortalJwtPayload } from '../portal/portal-jwt.util';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import type { CmktPortalContentSummary } from './portal-content-marketing.types';
import { buildStaffContentOsUrl, toPortalSummaryItem } from './portal-content-marketing.util';

@Injectable()
export class PortalContentMarketingSummaryService {
  constructor(
    private readonly config: AppConfigService,
    private readonly lifecycle: ServiceLifecycleService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly workflow: ContentWorkflowService,
  ) {}

  private opsWebBaseUrl(): string {
    return (process.env.PTT_OPS_WEB_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  }

  private isEnabled(): boolean {
    return this.config.contentMarketingPortalSummaryEnabled && this.config.contentMarketingEnabled;
  }

  private assertClient(user: PortalJwtPayload): string {
    const clientId = String(user.client_id ?? '').trim();
    if (!clientId) throw new ForbiddenException({ error: 'missing_client_id' });
    return clientId;
  }

  private async assertPortalLifecycleAccess(
    user: PortalJwtPayload,
    lifecycleId: number,
  ): Promise<{ serviceSlug: string }> {
    const clientId = this.assertClient(user);
    let ctx;
    try {
      ctx = await this.lifecycle.context(lifecycleId);
    } catch (err) {
      if (err instanceof NotFoundException) {
        throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
      }
      throw err;
    }
    const agencyClientId = String(ctx.contract.agency_client_id ?? '').trim();
    if (!agencyClientId || agencyClientId !== clientId) {
      throw new ForbiddenException({ error: 'lifecycle_client_mismatch' });
    }
    const serviceSlug = String(ctx.service_slug ?? '').trim();
    this.core.assertEnabled(serviceSlug);
    return { serviceSlug };
  }

  async contentSummary(
    user: PortalJwtPayload,
    lifecycleId: number,
  ): Promise<CmktPortalContentSummary> {
    if (!this.isEnabled()) {
      return {
        ok: true,
        enabled: false,
        lifecycle_id: lifecycleId,
        service_slug: '',
        items_by_status: {},
        pending_client_count: 0,
        published_mtd: 0,
        pending_items: [],
        staff_content_url: '',
      };
    }

    const { serviceSlug } = await this.assertPortalLifecycleAccess(user, lifecycleId);
    const [counts, pendingRows] = await Promise.all([
      this.repo.getContextCounts(lifecycleId),
      this.repo.listItems(lifecycleId, { status: 'pending_client' }),
    ]);

    return {
      ok: true,
      enabled: true,
      lifecycle_id: lifecycleId,
      service_slug: serviceSlug,
      items_by_status: counts.items_by_status,
      pending_client_count: Number(counts.items_by_status.pending_client ?? pendingRows.length),
      published_mtd: counts.published_mtd,
      pending_items: pendingRows.slice(0, 12).map(toPortalSummaryItem),
      staff_content_url: buildStaffContentOsUrl(this.opsWebBaseUrl(), lifecycleId),
    };
  }

  private assertPortalApprover(user: PortalJwtPayload): void {
    if (user.role !== 'approver') {
      throw new ForbiddenException({ error: 'portal_approver_required' });
    }
  }

  async portalClientApprove(user: PortalJwtPayload, lifecycleId: number, itemId: number) {
    await this.assertPortalLifecycleAccess(user, lifecycleId);
    this.assertPortalApprover(user);
    const item = await this.workflow.clientApprove(
      lifecycleId,
      itemId,
      `portal:${user.email}`,
    );
    return { ok: true, item: toPortalSummaryItem(item) };
  }

  async portalClientReject(
    user: PortalJwtPayload,
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
  ) {
    await this.assertPortalLifecycleAccess(user, lifecycleId);
    this.assertPortalApprover(user);
    const item = await this.workflow.clientReject(
      lifecycleId,
      itemId,
      body,
      `portal:${user.email}`,
    );
    return { ok: true, item: toPortalSummaryItem(item) };
  }
}
