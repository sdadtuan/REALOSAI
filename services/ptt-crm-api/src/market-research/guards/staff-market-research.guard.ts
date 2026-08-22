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

async function requireResearchCap(
  staffAuth: StaffAuthService,
  req: StaffReq,
  action: 'view' | 'create' | 'edit' | 'approve' | 'run' | 'export' | 'configure',
): Promise<boolean> {
  if (req.staffAuthVia === 'internal') return true;
  if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

  const me = await staffAuth.me(req.staffUser);
  if (!staffAuth.hasCap(me.caps, 'crm_research', action)) {
    throw new ForbiddenException({ error: 'missing_cap', section: 'crm_research', action });
  }
  return true;
}

@Injectable()
export class StaffMarketResearchViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'view',
    );
  }
}

@Injectable()
export class StaffMarketResearchCreateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'create',
    );
  }
}

@Injectable()
export class StaffMarketResearchEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'edit',
    );
  }
}

@Injectable()
export class StaffMarketResearchApproveGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'approve',
    );
  }
}

@Injectable()
export class StaffMarketResearchRunGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'run',
    );
  }
}

@Injectable()
export class StaffResearchMktplanEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_mktplan', 'edit')) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return true;
  }
}

@Injectable()
export class StaffMarketResearchWhatIfGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    await requireResearchCap(this.staffAuth, req, 'view');
    const body = req.body as { persist?: boolean } | undefined;
    if (body?.persist === true) {
      await requireResearchCap(this.staffAuth, req, 'edit');
    }
    return true;
  }
}

@Injectable()
export class StaffResearchContentWriteGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });
    const me = await this.staffAuth.me(req.staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'crm_content', 'write')) {
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_content', action: 'write' });
    }
    return true;
  }
}

@Injectable()
export class StaffMarketResearchExportGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'export',
    );
  }
}

@Injectable()
export class StaffMarketResearchConfigureGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    return requireResearchCap(
      this.staffAuth,
      context.switchToHttp().getRequest<StaffReq>(),
      'configure',
    );
  }
}
