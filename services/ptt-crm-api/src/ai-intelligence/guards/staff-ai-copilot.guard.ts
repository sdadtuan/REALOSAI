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

@Injectable()
export class StaffAiCopilotGuard implements CanActivate {
  constructor(
    private readonly aiConfig: AiIntelligenceConfigService,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();

    if (req.staffAuthVia === 'internal') {
      return true;
    }

    if (!this.aiConfig.copilotEnabled) {
      throw new ServiceUnavailableException({
        error: 'ai_copilot_disabled',
        message: 'PTT_AI_COPILOT_ENABLED=0',
      });
    }

    const staffId = req.staffUser?.sub;
    if (!staffId) {
      throw new UnauthorizedException({ error: 'staff_required' });
    }

    const me = await this.staffAuth.me(req.staffUser!);
    if (!this.aiConfig.canUseCopilot(staffId, me.caps)) {
      throw new ForbiddenException({
        error: 'copilot_rollout_denied',
        staff_id: staffId,
        rollout_mode: this.aiConfig.copilotRolloutMode,
      });
    }

    return true;
  }
}
