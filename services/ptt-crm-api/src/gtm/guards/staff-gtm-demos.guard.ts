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

type StaffReq = Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' };

async function requireGtmDemoCap(
  staffAuth: StaffAuthService,
  req: StaffReq,
  action: 'view' | 'write',
): Promise<boolean> {
  if (req.staffAuthVia === 'internal') return true;
  if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

  const me = await staffAuth.me(req.staffUser);
  if (!staffAuth.hasCap(me.caps, 'gtm_demos', action)) {
    throw new ForbiddenException({ error: 'missing_cap', section: 'gtm_demos', action });
  }
  return true;
}

@Injectable()
export class StaffGtmDemosViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireGtmDemoCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'view',
    );
  }
}

@Injectable()
export class StaffGtmDemosWriteGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireGtmDemoCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'write',
    );
  }
}
