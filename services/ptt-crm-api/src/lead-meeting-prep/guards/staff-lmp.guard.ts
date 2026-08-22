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

async function checkCap(
  staffAuth: StaffAuthService,
  req: Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' },
  section: string,
  action: string,
  fallbacks: Array<{ section: string; action: string }> = [],
): Promise<boolean> {
  if (req.staffAuthVia === 'internal') return true;
  if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
  const me = await staffAuth.me(req.staffUser);
  const checks = [{ section, action }, ...fallbacks];
  for (const cap of checks) {
    if (staffAuth.hasCap(me.caps, cap.section, cap.action)) return true;
  }
  throw new ForbiddenException({ error: 'missing_cap', section, action });
}

@Injectable()
export class StaffLmpViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    return checkCap(this.staffAuth, req, 'crm_lmp', 'view', [{ section: 'crm_leads', action: 'view' }]);
  }
}

@Injectable()
export class StaffLmpRunGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    return checkCap(this.staffAuth, req, 'crm_lmp', 'run', [{ section: 'crm_leads', action: 'edit' }]);
  }
}
