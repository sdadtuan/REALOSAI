import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import type { AdminScope } from '../admin-intelligence.types';

export const ADMIN_SCOPE_KEY = 'adminScope';

export const RequireAdminScope = (scope: AdminScope) => SetMetadata(ADMIN_SCOPE_KEY, scope);

@Injectable()
export class DelegatedAdminGuard implements CanActivate {
  constructor(
    private readonly staffAuth: StaffAuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;

    const scope = this.reflector.get<AdminScope | undefined>(ADMIN_SCOPE_KEY, context.getHandler());
    if (!scope) return true;

    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);

    if (this.staffAuth.hasCap(me.caps, 'crm_data_config', 'configure')) {
      return true;
    }
    if (this.staffAuth.hasCap(me.caps, 'admin_scope', scope)) {
      return true;
    }

    throw new ForbiddenException({
      error: 'missing_admin_scope',
      scope,
      message: `Requires admin_scope.${scope} or crm_data_config.configure`,
    });
  }
}
