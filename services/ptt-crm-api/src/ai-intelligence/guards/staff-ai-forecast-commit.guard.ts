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

/** AI-UC-013 / UI-R3-02 — GDKD cam kết forecast (ai_forecast.commit hoặc business dashboard configure). */
@Injectable()
export class StaffAiForecastCommitGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();

    if (req.staffAuthVia === 'internal') {
      return true;
    }

    if (!req.staffUser) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'ai_forecast', 'commit') ||
      this.staffAuth.hasCap(me.caps, 'crm_business_dashboard', 'configure') ||
      this.staffAuth.hasCap(me.caps, 'ai_admin', 'view')
    ) {
      return true;
    }

    throw new ForbiddenException({
      error: 'forecast_commit_forbidden',
      message: 'Requires ai_forecast.commit or crm_business_dashboard.configure (GDKD)',
    });
  }
}
