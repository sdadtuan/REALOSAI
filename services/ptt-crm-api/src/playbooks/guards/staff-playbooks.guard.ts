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
export class StaffPlaybooksViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.checkCap(context, 'view');
  }

  protected async checkCap(context: ExecutionContext, action: 'view' | 'configure'): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'playbooks', action)) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'playbooks',
        action,
      });
    }
    return true;
  }
}

@Injectable()
export class StaffPlaybooksConfigureGuard extends StaffPlaybooksViewGuard {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return this.checkCap(context, 'configure');
  }
}
