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

@Injectable()
export class StaffOrgRosterViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view') &&
      !this.staffAuth.hasCap(me.caps, 'crm_data_config', 'view')
    ) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster', action: 'view' });
    }
    return true;
  }
}

@Injectable()
export class StaffOrgDepartmentsViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_staff_departments', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_data_config', 'view')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_staff_departments',
      action: 'view',
    });
  }
}

@Injectable()
export class StaffOrgDepartmentsConfigureGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_staff_departments', 'configure') ||
      this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_staff_departments',
      action: 'configure',
    });
  }
}

@Injectable()
export class StaffOrgConfigureGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure')) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_data_config',
        action: 'configure',
      });
    }
    return true;
  }
}

@Injectable()
export class StaffOrgRosterEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_staff_roster', action: 'edit' });
    }
    return true;
  }
}

@Injectable()
export class StaffOrgEffectiveCapsGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt'; params?: { id?: string } }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    const target = String(req.params?.id ?? '').trim();
    if (target && (target === me.id || target === me.email)) return true;
    if (this.staffAuth.hasCap(me.caps, 'crm_data_config', 'view')) return true;
    if (this.staffAuth.hasCap(me.caps, 'crm_staff_roster', 'view')) return true;
    throw new ForbiddenException({ error: 'forbidden_effective_caps' });
  }
}
