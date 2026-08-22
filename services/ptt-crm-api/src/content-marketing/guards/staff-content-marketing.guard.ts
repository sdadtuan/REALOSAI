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
export class StaffContentMarketingViewGuard implements CanActivate {
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
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'view') &&
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'write') &&
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'generate')
    ) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_content',
        action: 'view_or_write_or_generate',
      });
    }
    return true;
  }
}

@Injectable()
export class StaffContentMarketingWriteGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_content', 'write')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_content', action: 'write' });
    }
    return true;
  }
}

@Injectable()
export class StaffContentMarketingGenerateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_content', 'generate')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_content', action: 'generate' });
    }
    return true;
  }
}

@Injectable()
export class StaffContentMarketingApproveGuard implements CanActivate {
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
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'approve_internal') &&
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'qa')
    ) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_content',
        action: 'approve_internal_or_qa',
      });
    }
    return true;
  }
}

@Injectable()
export class StaffContentMarketingPublishGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'publish') &&
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_content',
        action: 'publish_or_write',
      });
    }
    return true;
  }
}

@Injectable()
export class StaffContentMarketingAssignGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (!this.staffAuth.hasCap(me.caps, 'crm_content', 'assign')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_content', action: 'assign' });
    }
    return true;
  }
}

@Injectable()
export class StaffContentMarketingProductionGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_board', 'edit')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_board', action: 'edit' });
    }
    if (
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'production') &&
      !this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'crm_content',
        action: 'production_or_write',
      });
    }
    return true;
  }
}
