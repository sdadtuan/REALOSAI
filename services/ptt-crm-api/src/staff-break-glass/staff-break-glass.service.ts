import { Injectable } from '@nestjs/common';
import { StaffRbacAuditRepository } from '../staff-permissions/staff-rbac-audit.repository';
import { StaffBreakGlassRepository } from './staff-break-glass.repository';
import type { ApproveBreakGlassBody, BreakGlassListResponse, RequestBreakGlassBody } from './staff-break-glass.types';

@Injectable()
export class StaffBreakGlassService {
  constructor(
    private readonly repo: StaffBreakGlassRepository,
    private readonly audit: StaffRbacAuditRepository,
  ) {}

  request(userId: string, body: RequestBreakGlassBody, actorEmail: string) {
    return this.repo.createRequest(userId, body).then(async (grant) => {
      await this.audit.log({
        event_type: 'break_glass_request',
        actor_email: actorEmail,
        subject_user_id: userId,
        metadata: { grant_id: grant.id, caps: grant.caps, reason: grant.reason },
      });
      return grant;
    });
  }

  listActive(): Promise<BreakGlassListResponse> {
    return this.repo.listActive().then((grants) => ({ grants }));
  }

  approve(id: string, body: ApproveBreakGlassBody, approverEmail: string) {
    if (body.approve === false) {
      return this.repo.reject(id, approverEmail).then(async (grant) => {
        await this.audit.log({
          event_type: 'break_glass_rejected',
          actor_email: approverEmail,
          subject_user_id: grant.user_id,
          metadata: { grant_id: grant.id, reason: body.reject_reason ?? '' },
        });
        return grant;
      });
    }
    return this.repo.approve(id, approverEmail).then(async (grant) => {
      await this.audit.log({
        event_type: 'break_glass_approved',
        actor_email: approverEmail,
        subject_user_id: grant.user_id,
        metadata: { grant_id: grant.id, expires_at: grant.expires_at, caps: grant.caps },
      });
      return grant;
    });
  }

  revokeExpired() {
    return this.repo.revokeExpired().then((count) => ({ revoked: count }));
  }

  loadActiveCapsForUser(userId: string) {
    return this.repo.loadActiveCapsForUser(userId);
  }
}
