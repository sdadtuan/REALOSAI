import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminAuditRepository } from '../admin-audit/admin-audit.repository';
import { AppConfigService } from '../config/app-config.service';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffPermissionsService } from '../staff-permissions/staff-permissions.service';
import type { PatchStaffPositionGrantsBody } from '../staff-permissions/staff-permissions.types';
import { AdminIntelligenceRepository } from './admin-intelligence.repository';
import type {
  AdminChangeRequest,
  CreateChangeRequestBody,
  RejectChangeRequestBody,
} from './admin-intelligence.types';

@Injectable()
export class ChangeApprovalService {
  constructor(
    private readonly repo: AdminIntelligenceRepository,
    private readonly permissions: StaffPermissionsService,
    private readonly staffAuth: StaffAuthService,
    private readonly adminAudit: AdminAuditRepository,
    private readonly config: AppConfigService,
  ) {}

  create(body: CreateChangeRequestBody, requesterEmail: string): Promise<AdminChangeRequest> {
    return this.repo.createChangeRequest(body, requesterEmail);
  }

  list(status?: AdminChangeRequest['status']): Promise<AdminChangeRequest[]> {
    return this.repo.listChangeRequests(status);
  }

  async get(id: string): Promise<AdminChangeRequest> {
    const row = await this.repo.getChangeRequest(id);
    if (!row) throw new NotFoundException({ error: 'change_request_not_found', id });
    return row;
  }

  async submit(id: string, requesterEmail: string): Promise<AdminChangeRequest> {
    const row = await this.get(id);
    if (row.status !== 'draft') {
      throw new BadRequestException({ error: 'invalid_status', status: row.status });
    }
    if (row.requester_email.toLowerCase() !== requesterEmail.toLowerCase()) {
      throw new ForbiddenException({ error: 'not_requester' });
    }
    const updated = await this.repo.updateChangeRequestStatus(id, 'pending', {});
    if (!updated) throw new NotFoundException({ error: 'change_request_not_found', id });
    return updated;
  }

  private async assertApprover(staff?: StaffJwtPayload): Promise<void> {
    if (!staff) throw new ForbiddenException({ error: 'missing_approver_cap' });
    const me = await this.staffAuth.me(staff);
    const canConfigure = this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure');
    const canApprove = this.staffAuth.hasCap(me.caps, 'admin_change', 'approve');
    if (!canConfigure && !canApprove) {
      throw new ForbiddenException({ error: 'missing_approver_cap' });
    }
  }

  private async resolvePositionId(entityKey: string): Promise<number> {
    const asNum = Number(entityKey);
    if (Number.isFinite(asNum) && asNum > 0) return asNum;
    const positions = await this.permissions.listPositions();
    const found = positions.find((p) => p.code === entityKey);
    if (!found) {
      throw new NotFoundException({ error: 'position_not_found', entity_key: entityKey });
    }
    return found.id;
  }

  async approve(id: string, approverEmail: string, staff?: StaffJwtPayload): Promise<AdminChangeRequest> {
    const row = await this.get(id);
    if (row.status !== 'pending') {
      throw new BadRequestException({ error: 'invalid_status', status: row.status });
    }
    if (row.requester_email.toLowerCase() === approverEmail.toLowerCase()) {
      throw new ForbiddenException({ error: 'self_approval_denied' });
    }
    await this.assertApprover(staff);

    const approved = await this.repo.updateChangeRequestStatus(id, 'approved', {
      approver_email: approverEmail.toLowerCase(),
    });
    if (!approved) throw new NotFoundException({ error: 'change_request_not_found', id });

    if (approved.kind === 'permission_matrix') {
      const positionId = await this.resolvePositionId(approved.entity_key);
      const patch = approved.patch_json as PatchStaffPositionGrantsBody;
      await this.permissions.patchPosition(positionId, patch, approverEmail, { bypassApproval: true });
      const applied = await this.repo.updateChangeRequestStatus(id, 'applied', {
        applied_at: new Date().toISOString(),
      });
      await this.adminAudit.logSyntheticEvent({
        event_type: 'change_request_applied',
        actor_email: approverEmail,
        category: 'change_request',
        severity: 'info',
        subject_label: approved.entity_key,
        subject_id: id,
        action: 'approve',
        summary: `Change request applied — position ${approved.entity_key}`,
        diff_json: { change_request_id: id },
      });
      return applied ?? approved;
    }

    return approved;
  }

  async reject(
    id: string,
    approverEmail: string,
    body: RejectChangeRequestBody,
    staff?: StaffJwtPayload,
  ): Promise<AdminChangeRequest> {
    const row = await this.get(id);
    if (row.status !== 'pending') {
      throw new BadRequestException({ error: 'invalid_status', status: row.status });
    }
    await this.assertApprover(staff);
    const updated = await this.repo.updateChangeRequestStatus(id, 'rejected', {
      approver_email: approverEmail.toLowerCase(),
      approver_note: body.note ?? '',
    });
    if (!updated) throw new NotFoundException({ error: 'change_request_not_found', id });
    return updated;
  }

  approvalRequired(): boolean {
    return this.config.adminMatrixApprovalRequired;
  }
}
