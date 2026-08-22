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
import { hasGdkdOverride } from '../../staff-permissions/staff-gdkd.util';

@Injectable()
export class StaffBreakGlassApproveGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      hasGdkdOverride(me.caps) ||
      this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure')
    ) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_gdkd', action: 'override' });
  }
}
