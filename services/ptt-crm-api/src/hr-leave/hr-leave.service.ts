import { ForbiddenException, Injectable } from '@nestjs/common';
import { StaffAuthService } from '../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { HrLeaveRepository } from './hr-leave.repository';
import type { ApproveLeaveRequestBody, CreateLeaveRequestBody } from './hr-leave.types';

@Injectable()
export class HrLeaveService {
  constructor(
    private readonly repo: HrLeaveRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) {
      throw new ForbiddenException({ error: 'staff_required' });
    }
    return payload;
  }

  async createRequest(payload: StaffJwtPayload | undefined, body: CreateLeaveRequestBody) {
    const user = this.requireUser(payload);
    const row = await this.repo.create(user.sub, user.email ?? '', body);
    return { ok: true, request: row };
  }

  async listRequests(payload: StaffJwtPayload | undefined, viewAll: boolean) {
    const user = this.requireUser(payload);
    const me = await this.staffAuth.me(user);
    const canApprove =
      this.staffAuth.hasCap(me.caps, 'crm_hr_leave', 'approve') ||
      this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure');

    if (viewAll && canApprove) {
      const pending = await this.repo.listPending();
      const mine = await this.repo.listForUser(user.sub);
      return { ok: true, mine, pending, can_approve: true };
    }

    const mine = await this.repo.listForUser(user.sub);
    return { ok: true, mine, pending: canApprove ? await this.repo.listPending() : [], can_approve: canApprove };
  }

  async approveRequest(
    payload: StaffJwtPayload | undefined,
    id: string,
    body: ApproveLeaveRequestBody,
  ) {
    const user = this.requireUser(payload);
    const row = await this.repo.approve(id, user.sub, user.email ?? '', body);
    return { ok: true, request: row };
  }
}
