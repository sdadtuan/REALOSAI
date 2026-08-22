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

/** AI-UC-006 / BR-AI-05 — chỉ GDKD (assign) hoặc ai_admin được override score. */
@Injectable()
export class StaffAiScoreOverrideGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();

    if (req.staffAuthVia === 'internal') {
      return true;
    }

    if (!req.staffUser) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }

    const me = await this.staffAuth.me(req.staffUser);
    if (hasGdkdAssign(me.caps) || this.staffAuth.hasCap(me.caps, 'ai_admin', 'view')) {
      return true;
    }

    throw new ForbiddenException({
      error: 'score_override_forbidden',
      message: 'Requires crm_gdkd.assign or ai_admin.view (GDKD)',
    });
  }
}
