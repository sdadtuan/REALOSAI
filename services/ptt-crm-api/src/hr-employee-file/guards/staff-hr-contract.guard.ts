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

function hasContractOrRosterCap(
  staffAuth: StaffAuthService,
  caps: StaffSectionCap[],
  action: 'view' | 'edit',
): boolean {
  if (staffAuth.hasCap(caps, 'crm_hr_contract', action)) return true;
  return staffAuth.hasCap(caps, 'crm_staff_roster', action === 'view' ? 'view' : 'edit');
}

@Injectable()
export class StaffHrContractViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasContractOrRosterCap(this.staffAuth, me.caps, 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_contract' });
    }
    return true;
  }
}

@Injectable()
export class StaffHrContractEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasContractOrRosterCap(this.staffAuth, me.caps, 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_contract' });
    }
    return true;
  }
}
