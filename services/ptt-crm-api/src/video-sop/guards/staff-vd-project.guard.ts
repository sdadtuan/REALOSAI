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
export class StaffVdProjectCreateGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'create') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.project',
      action: 'create',
    });
  }
}

@Injectable()
export class StaffVdProjectViewGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'create') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'view') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.project',
      action: 'view',
    });
  }
}

@Injectable()
export class StaffVdProjectEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.project',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdBibleEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.bible', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.bible',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdKeyframeEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.keyframe', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.keyframe',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdMotionEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.motion', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.motion',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdShotJobEnqueueGuard implements CanActivate {
  constructor(
    private readonly keyframeGuard: StaffVdKeyframeEditGuard,
    private readonly motionGuard: StaffVdMotionEditGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq & { body?: Record<string, unknown> }>();
    const jobType = typeof req.body?.job_type === 'string' ? req.body.job_type.trim() : '';
    if (jobType === 'cine_motion_draft' || jobType === 'cine_motion_final') {
      return this.motionGuard.canActivate(context);
    }
    return this.keyframeGuard.canActivate(context);
  }
}

@Injectable()
export class StaffVdPostEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.post', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.post',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdBudgetEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.budget', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.budget',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdQcEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.qc', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.qc',
      action: 'edit',
    });
  }
}

@Injectable()
export class StaffVdGateApproveGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const gateNo = Number(req.params?.n);
    const section =
      gateNo === 4
        ? 'crm_vd.qc'
        : gateNo === 3
          ? 'crm_vd.gate3'
          : gateNo === 2
            ? 'crm_vd.gate2'
            : 'crm_vd.gate1';
    const action = gateNo === 4 ? 'edit' : 'approve';

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, section, action) ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section,
      action,
    });
  }
}

@Injectable()
export class StaffVdScriptEditGuard implements CanActivate {
  constructor(private readonly staffAuth: StaffAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<StaffReq>();
    if (req.staffAuthVia === 'internal') return true;
    if (!req.staffUser) throw new UnauthorizedException({ error: 'Unauthorized' });

    const me = await this.staffAuth.me(req.staffUser);
    if (
      this.staffAuth.hasCap(me.caps, 'crm_vd.script', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_vd.project', 'edit') ||
      this.staffAuth.hasCap(me.caps, 'crm_content', 'write')
    ) {
      return true;
    }
    throw new ForbiddenException({
      error: 'missing_cap',
      section: 'crm_vd.script',
      action: 'edit',
    });
  }
}
