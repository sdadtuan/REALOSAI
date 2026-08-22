import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { AiIntelligenceConfigService } from '../ai-intelligence.config';

/** AI-UC-012 — deal batch scores use sales funnel cap; lead batch keeps copilot pilot. */
@Injectable()
export class StaffAiScoresBatchGuard implements CanActivate {
  constructor(
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        staffUser?: StaffJwtPayload;
        staffAuthVia?: 'internal' | 'jwt';
        query?: { entity_type?: string };
      }
    >();

    if (req.staffAuthVia === 'internal') {
      return true;
    }

    if (!req.staffUser) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }

    const entityType = String(req.query?.entity_type ?? 'lead').trim();

    if (entityType === 'deal') {
      const me = await this.staffAuth.me(req.staffUser);
      if (
        this.staffAuth.hasCap(me.caps, 'crm_sales_funnel', 'view') ||
        this.staffAuth.hasCap(me.caps, 'crm_sales_overview', 'view')
      ) {
        return true;
      }
      throw new ForbiddenException({ error: 'missing_cap', section: 'crm_sales_funnel', action: 'view' });
    }

    if (!this.aiConfig.copilotEnabled) {
      throw new ServiceUnavailableException({
        error: 'ai_copilot_disabled',
        message: 'PTT_AI_COPILOT_ENABLED=0',
      });
    }

    if (!this.aiConfig.canUseCopilot(req.staffUser.sub, (await this.staffAuth.me(req.staffUser)).caps)) {
      throw new ForbiddenException({
        error: 'copilot_rollout_denied',
        staff_id: req.staffUser.sub,
        rollout_mode: this.aiConfig.copilotRolloutMode,
      });
    }

    return true;
  }
}
