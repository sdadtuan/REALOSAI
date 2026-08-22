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
import type { StaffSectionCap } from '../../staff-auth/staff-auth.types';

function hasDocsOrRosterCap(
  staffAuth: StaffAuthService,
  caps: StaffSectionCap[],
  docsAction: 'view' | 'edit' | 'download',
): boolean {
  if (staffAuth.hasCap(caps, 'crm_hr_docs', docsAction)) return true;
  if (docsAction === 'download' && staffAuth.hasCap(caps, 'crm_hr_docs', 'view')) return true;
  const rosterAction = docsAction === 'view' || docsAction === 'download' ? 'view' : 'edit';
  return staffAuth.hasCap(caps, 'crm_staff_roster', rosterAction);
}

@Injectable()
export class StaffHrDocsViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasDocsOrRosterCap(this.staffAuth, me.caps, 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    }
    return true;
  }
}

@Injectable()
export class StaffHrDocsEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasDocsOrRosterCap(this.staffAuth, me.caps, 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    }
    return true;
  }
}

@Injectable()
export class StaffHrDocsDownloadGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasDocsOrRosterCap(this.staffAuth, me.caps, 'download')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_docs' });
    }
    return true;
  }
}
