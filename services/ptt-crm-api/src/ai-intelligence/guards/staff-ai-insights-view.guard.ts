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

/** WIN-4-C — CPL digest / AI insights surfaces. */
@Injectable()
export class StaffAiInsightsViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_ai_insights', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_business_dashboard', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_kpi_records', 'view') ||
      this.staffAuth.hasCap(me.caps, 'ai_admin', 'view')
    ) {
      return true;
    }

    throw new ForbiddenException({
      error: 'ai_insights_view_forbidden',
      message: 'Requires crm_ai_insights.view',
    });
  }
}
