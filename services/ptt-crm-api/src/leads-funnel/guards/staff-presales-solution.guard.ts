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
import { hasGdkdAssign } from '../../staff-permissions/staff-gdkd.util';
import { assertPresalesSolutionCap } from '../presales-solution-rbac.util';

function assertCapOrThrow(
  caps: Array<{ section: string; action: string }>,
  action: 'view' | 'edit' | 'claim' | 'release',
): void {
  const gdkdAssign = hasGdkdAssign(caps);
  assertPresalesSolutionCap(caps, action, { gdkdAssign });
}

@Injectable()
export class StaffPresalesSolutionClaimGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    assertCapOrThrow(me.caps, 'claim');
    return true;
  }
}

@Injectable()
export class StaffPresalesSolutionReleaseGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    assertCapOrThrow(me.caps, 'release');
    return true;
  }
}

/** Solution queue: view cap OR crm_leads.view (AM read-only tracking). */
@Injectable()
export class StaffPresalesSolutionQueueGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_presales_solution', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_leads', 'view')
    ) {
      return true;
    }
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_presales_solution' });
  }
}
