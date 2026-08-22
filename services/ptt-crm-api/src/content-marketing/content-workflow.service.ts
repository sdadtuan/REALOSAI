import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import { ContentProductionService } from './content-production.service';
import {
  assertBodyNonEmpty,
  assertRejectComment,
  assertTransition,
  CMKT_APPROVE_REJECT_FROM,
  CMKT_CLIENT_DECIDE_FROM,
  CMKT_SUBMIT_CLIENT_FROM,
  CMKT_SUBMIT_REVIEW_FROM,
} from './content-workflow.util';
import type { CmktItemRow, CmktReviewQueueItem, CmktReviewQueueSummary } from './content-marketing.types';

@Injectable()
export class ContentWorkflowService {
  constructor(
    private readonly config: AppConfigService,
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly production: ContentProductionService,
  ) {}

  private assertClientGateEnabled(): void {
    if (!this.config.contentMarketingClientGate) {
      throw new BadRequestException({
        error: 'client_gate_disabled',
        message: 'Bật PTT_CONTENT_MARKETING_CLIENT_GATE=1 để dùng client approval.',
      });
    }
  }

  async submitReview(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(item.status, CMKT_SUBMIT_REVIEW_FROM, 'submit_review');
    assertBodyNonEmpty(item.body_json);

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      status: 'in_review',
      in_review_at: new Date().toISOString(),
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'submit_review');
    return updated;
  }

  async approve(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(item.status, CMKT_APPROVE_REJECT_FROM, 'approve');

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      status: 'approved_internal',
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'approve');
    await this.production.initProductionOnApprove(lifecycleId, itemId);
    return updated;
  }

  async reject(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(item.status, CMKT_APPROVE_REJECT_FROM, 'reject');
    const comment = assertRejectComment(body.comment ?? body.body);

    await this.repo.insertItemComment({
      item_id: itemId,
      author_id: actorEmail,
      body: comment,
      visibility: 'internal',
    });

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      status: 'changes_requested',
      in_review_at: null,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'reject');
    return updated;
  }

  async listReviewQueue(
    lifecycleId: number,
    filters: { sla_breach?: boolean; channel?: string },
  ): Promise<{ items: CmktReviewQueueItem[] }> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const items = await this.repo.listReviewQueue(lifecycleId, filters);
    return { items };
  }

  async reviewQueueSummary(lifecycleId: number): Promise<CmktReviewQueueSummary> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    return this.repo.getReviewQueueSummary(lifecycleId);
  }

  async submitToClient(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    this.assertClientGateEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(item.status, CMKT_SUBMIT_CLIENT_FROM, 'submit_client');

    const updated = await this.repo.patchItem(lifecycleId, itemId, { status: 'pending_client' });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'submit_client');
    return updated;
  }

  async clientApprove(
    lifecycleId: number,
    itemId: number,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    this.assertClientGateEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(item.status, CMKT_CLIENT_DECIDE_FROM, 'client_approve');

    const updated = await this.repo.patchItem(lifecycleId, itemId, { status: 'client_approved' });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'client_approve');
    return updated;
  }

  async clientReject(
    lifecycleId: number,
    itemId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktItemRow> {
    this.assertClientGateEnabled();
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const item = await this.repo.getItemById(lifecycleId, itemId);
    if (!item) throw new NotFoundException({ error: 'item_not_found', id: itemId });

    assertTransition(item.status, CMKT_CLIENT_DECIDE_FROM, 'client_reject');
    const comment = assertRejectComment(body.comment ?? body.feedback);

    await this.repo.insertItemComment({
      item_id: itemId,
      author_id: actorEmail,
      body: comment,
      visibility: 'client',
    });

    const updated = await this.repo.patchItem(lifecycleId, itemId, {
      status: 'changes_requested',
      in_review_at: null,
    });
    await this.repo.insertItemVersion(itemId, updated.body_json, actorEmail, 'client_reject');
    return updated;
  }
}
