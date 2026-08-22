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

@Injectable()
export class StaffMarketingAiPlannerViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'view' });
    }
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'view') &&
      !this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'generate')
    ) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_mkt_ai',
        action: 'view_or_generate',
      });
    }
    return true;
  }
}

@Injectable()
export class StaffMarketingAiPlannerGenerateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'generate')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_mkt_ai', action: 'generate' });
    }
    return true;
  }
}

@Injectable()
export class StaffMarketingAiPlannerExportGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'view')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'view' });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'export')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_mkt_ai', action: 'export' });
    }
    return true;
  }
}

@Injectable()
export class StaffMarketingAiPlannerApproveGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_mkt_ai', 'approve')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_mkt_ai', action: 'approve' });
    }
    return true;
  }
}
