import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';

@Injectable()
export class StaffHrLeaveRequestGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_hr_leave', 'request') ||
      this.staffAuth.hasCap(me.caps, 'crm_hr_leave', 'approve') ||
      this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view')
    ) {
      return true;
    }

    throw new ForbiddenException({
      error: 'hr_leave_request_forbidden',
      message: 'Requires crm_hr_leave.request',
    });
  }
}

@Injectable()
export class StaffHrLeaveApproveGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_hr_leave', 'approve') ||
      this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure')
    ) {
      return true;
    }

    throw new ForbiddenException({
      error: 'hr_leave_approve_forbidden',
      message: 'Requires crm_hr_leave.approve',
    });
  }
}
