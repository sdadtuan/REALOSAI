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

function hasAttendanceView(staffAuth: StaffAuthService, caps: StaffSectionCap[]): boolean {
  return (
    staffAuth.hasCap(caps, 'crm_payroll_attendance', 'view') ||
    staffAuth.hasCap(caps, 'crm_hr_attendance', 'device') ||
    staffAuth.hasCap(caps, 'crm_staff_roster', 'view')
  );
}

function hasAttendanceDevice(staffAuth: StaffAuthService, caps: StaffSectionCap[]): boolean {
  return (
    staffAuth.hasCap(caps, 'crm_hr_attendance', 'device') ||
    staffAuth.hasCap(caps, 'crm_staff_roster', 'edit')
  );
}

function hasAttendanceReview(staffAuth: StaffAuthService, caps: StaffSectionCap[]): boolean {
  return (
    staffAuth.hasCap(caps, 'crm_hr_attendance', 'review') ||
    staffAuth.hasCap(caps, 'crm_staff_roster', 'edit')
  );
}

function hasAttendanceGps(staffAuth: StaffAuthService, caps: StaffSectionCap[]): boolean {
  return staffAuth.hasCap(caps, 'crm_hr_attendance', 'gps');
}

@Injectable()
export class StaffHrAttendanceGpsGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasAttendanceGps(this.staffAuth, me.caps)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    }
    return true;
  }
}

@Injectable()
export class StaffHrAttendanceReviewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasAttendanceReview(this.staffAuth, me.caps)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    }
    return true;
  }
}

@Injectable()
export class StaffHrAttendanceViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasAttendanceView(this.staffAuth, me.caps)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_payroll_attendance' });
    }
    return true;
  }
}

@Injectable()
export class StaffHrAttendanceDeviceGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!hasAttendanceDevice(this.staffAuth, me.caps)) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_hr_attendance' });
    }
    return true;
  }
}
