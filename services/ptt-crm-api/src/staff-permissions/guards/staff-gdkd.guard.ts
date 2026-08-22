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
import { hasGdkdCap, type GdkdCapAction } from '../staff-gdkd.util';

/** R2-A — GDKD override / assign guard (replaces direct crm_leads.assign checks). */
@Injectable()
export class StaffGdkdOverrideGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        staffUser?: StaffJwtPayload;
        staffAuthVia?: 'internal' | 'jwt';
        gdkdAction?: GdkdCapAction;
      }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    const action: GdkdCapAction = req.gdkdAction ?? 'assign';
    if (!hasGdkdCap(me.caps, action)) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_gdkd',
        action,
        message: `Requires crm_gdkd.${action}`,
      });
    }
    return true;
  }
}
