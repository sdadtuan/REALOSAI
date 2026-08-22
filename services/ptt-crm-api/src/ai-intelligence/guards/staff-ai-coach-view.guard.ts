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

/** AI-UC-018 / UI-R3-05 — GDKD xem coach weekly digest. */
@Injectable()
export class StaffAiCoachViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();

    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_kpi_records', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_business_dashboard', 'view') ||
      this.staffAuth.hasCap(me.caps, 'ai_admin', 'view')
    ) {
      return true;
    }

    throw new ForbiddenException({
      error: 'coach_digest_view_forbidden',
      message: 'Requires crm_kpi_records.view or crm_business_dashboard.view',
    });
  }
}
