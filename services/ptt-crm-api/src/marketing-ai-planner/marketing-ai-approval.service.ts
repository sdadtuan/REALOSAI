import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { StaffNotificationsRepository } from '../staff-notifications/staff-notifications.repository';
import {
  assertApprovalTransition,
  buildPlanVersionLabel,
  canExportWithApproval,
  snapshotFromDraft,
  versionStatusForDecision,
  type MktAiApprovalDecision,
} from './marketing-ai-approval.util';
import { computeQualityScore } from './marketing-ai-quality.util';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import type {
  MktAiApprovalContext,
  MktAiApprovalRow,
  MktAiBrief,
  MktAiCommentRow,
  MktAiDraft,
} from './marketing-ai-planner.types';

@Injectable()
export class MarketingAiApprovalService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: MarketingAiPlannerRepository,
    private readonly notifications: StaffNotificationsRepository,
  ) {}

  isFeatureEnabled(): boolean {
    return this.config.mktAiApprovalRequired;
  }

  async buildContext(
    lifecycleId: number,
    brief: MktAiBrief | null,
    draft: MktAiDraft,
    qualityCanExport: boolean,
  ): Promise<{
    approval: MktAiApprovalContext;
    comments: MktAiCommentRow[];
  }> {
    const required = this.isFeatureEnabled();
    const latest = required ? await this.repo.getLatestApproval(lifecycleId) : null;
    const pending = required ? await this.repo.getPendingApproval(lifecycleId) : null;
    const canExport = qualityCanExport && canExportWithApproval(required, latest?.status);
    const canSubmit = required && qualityCanExport && !pending;

    return {
      approval: {
        required,
        latest,
        can_export: canExport,
        can_submit: canSubmit,
      },
      comments: required
        ? await this.repo.listComments(lifecycleId, latest?.plan_version_id ?? undefined, 20)
        : [],
    };
  }

  async listApprovals(lifecycleId: number): Promise<MktAiApprovalRow[]> {
    return this.repo.listApprovals(lifecycleId);
  }

  async listComments(lifecycleId: number, planVersionId?: number): Promise<MktAiCommentRow[]> {
    return this.repo.listComments(lifecycleId, planVersionId);
  }

  async submitForApproval(
    lifecycleId: number,
    actorEmail: string,
    body: { label?: string; note?: string },
  ): Promise<{ approval: MktAiApprovalRow; plan_version_id: number }> {
    if (!this.isFeatureEnabled()) {
      throw new ForbiddenException({ error: 'approval_workflow_disabled' });
    }

    const pending = await this.repo.getPendingApproval(lifecycleId);
    if (pending) {
      throw new BadRequestException({ error: 'approval_pending', approval_id: pending.id });
    }

    const briefRow = await this.repo.getBrief(lifecycleId);
    const draft = await this.repo.ensureDraft(lifecycleId, actorEmail);
    const quality = computeQualityScore(briefRow?.brief_json ?? null, draft);
    if (!quality.can_export) {
      throw new BadRequestException({
        error: 'quality_score_too_low',
        score: quality.score,
        message: 'Cần quality ≥60 trước khi gửi duyệt.',
      });
    }

    const versionNo = await this.repo.getNextPlanVersionNo(lifecycleId);
    const label = buildPlanVersionLabel(versionNo, body.label);
    const snapshot = snapshotFromDraft(briefRow?.brief_json ?? null, draft);
    const version = await this.repo.createPlanVersion({
      lifecycle_id: lifecycleId,
      version_no: versionNo,
      label,
      status: 'pending_approval',
      ...snapshot,
      quality_score_json: {
        ...(draft.quality_score_json ?? {}),
        score: quality.score,
      },
      created_by: actorEmail,
    });

    const approval = await this.repo.createApproval({
      lifecycle_id: lifecycleId,
      plan_version_id: version.id,
      requested_by: actorEmail,
      decision_note: body.note ?? '',
    });

    await this.notifyApprovers(
      lifecycleId,
      'AI Planner — chờ duyệt kế hoạch MKT',
      `${actorEmail} gửi ${label} lifecycle #${lifecycleId}`,
    );

    return { approval, plan_version_id: version.id };
  }

  async decideApproval(
    lifecycleId: number,
    approvalId: number,
    decision: MktAiApprovalDecision,
    actorEmail: string,
    note?: string,
  ): Promise<MktAiApprovalRow> {
    if (!this.isFeatureEnabled()) {
      throw new ForbiddenException({ error: 'approval_workflow_disabled' });
    }

    const approvals = await this.repo.listApprovals(lifecycleId, 100);
    const approval = approvals.find((a) => a.id === approvalId);
    if (!approval) {
      throw new NotFoundException({ error: 'approval_not_found', approval_id: approvalId });
    }

    assertApprovalTransition(approval.status, decision);

    const updated = await this.repo.decideApproval(approvalId, {
      status: decision,
      approver_email: actorEmail,
      decision_note: note,
    });
    if (!updated) {
      throw new NotFoundException({ error: 'approval_not_found', approval_id: approvalId });
    }

    await this.repo.updatePlanVersionStatus(
      approval.plan_version_id,
      versionStatusForDecision(decision) as 'approved' | 'archived' | 'draft',
    );

    const decisionVi =
      decision === 'approved'
        ? 'đã duyệt'
        : decision === 'rejected'
          ? 'đã từ chối'
          : 'yêu cầu chỉnh sửa';
    await this.notifyApprovers(
      lifecycleId,
      `AI Planner — ${decisionVi}`,
      `${actorEmail}: ${labelForDecision(decision)} lifecycle #${lifecycleId}`,
    );

    return updated;
  }

  async addComment(
    lifecycleId: number,
    actorEmail: string,
    body: {
      body: string;
      plan_version_id?: number;
      approval_id?: number;
      anchor?: Record<string, unknown>;
    },
  ): Promise<MktAiCommentRow> {
    const text = String(body.body ?? '').trim();
    if (!text) {
      throw new BadRequestException({ error: 'comment_body_required' });
    }

    let planVersionId = body.plan_version_id ?? null;
    let approvalId = body.approval_id ?? null;

    if (approvalId != null) {
      const approvals = await this.repo.listApprovals(lifecycleId, 100);
      const approval = approvals.find((a) => a.id === approvalId);
      if (!approval) {
        throw new NotFoundException({ error: 'approval_not_found', approval_id: approvalId });
      }
      planVersionId = approval.plan_version_id;
    } else if (planVersionId == null) {
      const latest = await this.repo.getLatestApproval(lifecycleId);
      planVersionId = latest?.plan_version_id ?? null;
      approvalId = latest?.id ?? null;
    }

    return this.repo.createComment({
      lifecycle_id: lifecycleId,
      plan_version_id: planVersionId,
      approval_id: approvalId,
      author_email: actorEmail,
      body: text,
      anchor_json: body.anchor ?? {},
    });
  }

  assertExportAllowed(approvalRequired: boolean, latestStatus?: string | null): void {
    if (!canExportWithApproval(approvalRequired, latestStatus as never)) {
      throw new BadRequestException({
        error: 'approval_required',
        message: 'Export cần MKT Lead duyệt trước (BR-MKTP-09).',
      });
    }
  }

  private async notifyApprovers(
    lifecycleId: number,
    title: string,
    body: string,
  ): Promise<void> {
    const userIds = this.config.mktAiApproverNotifyUserIds;
    if (!userIds.length) return;
    try {
      await this.notifications.createMany(
        userIds.map((user_id) => ({
          user_id,
          kind: 'action',
          title,
          body,
          link_href: `/crm/service-delivery/${lifecycleId}?tab=ai-planner&step=apply`,
          meta_json: { lifecycle_id: lifecycleId, source: 'mkt_ai_planner' },
        })),
      );
    } catch {
      /* notifications optional */
    }
  }
}

function labelForDecision(decision: MktAiApprovalDecision): string {
  if (decision === 'approved') return 'Duyệt kế hoạch';
  if (decision === 'rejected') return 'Từ chối kế hoạch';
  return 'Yêu cầu sửa kế hoạch';
}
