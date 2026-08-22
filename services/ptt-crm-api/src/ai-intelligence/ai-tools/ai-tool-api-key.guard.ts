import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from '../../staff-auth/staff-auth.service';
import { StaffJwtPayload } from '../../staff-auth/staff-jwt.util';
import { AiToolKeysRepository } from './ai-tool-keys.repository';
import { AiToolApiKeyRecord } from './ai-tools.types';

interface RateWindow {
  count: number;
  startedAt: number;
}

export type AiToolAuthenticatedRequest = Request & {
  aiToolApiKey?: AiToolApiKeyRecord;
  staffUser?: StaffJwtPayload;
  staffAuthVia?: 'jwt';
};

@Injectable()
export class AiToolApiKeyGuard implements CanActivate {
  private readonly rateWindows = new Map<string, RateWindow>();

  constructor(
    private readonly keys: AiToolKeysRepository,
    private readonly staffAuth: StaffAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AiToolAuthenticatedRequest>();
    const plaintextKey = String(req.headers['x-ai-tool-key'] ?? '').trim();
    if (plaintextKey) {
      const apiKey = await this.keys.validateKey(plaintextKey);
      if (!apiKey) {
        throw new UnauthorizedException({ error: 'invalid_ai_tool_key' });
      }
      this.consumeRateLimit(apiKey);
      req.aiToolApiKey = apiKey;
      return true;
    }

    const authorization = String(req.headers.authorization ?? '').trim();
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : '';
    if (!token) {
      throw new UnauthorizedException({ error: 'Unauthorized' });
    }

    const staffUser = await this.staffAuth.verifyAccessToken(token);
    const me = await this.staffAuth.me(staffUser);
    if (!this.staffAuth.hasCap(me.caps, 'ai_admin', 'view')) {
      throw new ForbiddenException({
        error: 'missing_cap',
        section: 'ai_admin',
        action: 'view',
      });
    }
    req.staffUser = staffUser;
    req.staffAuthVia = 'jwt';
    return true;
  }

  private consumeRateLimit(apiKey: AiToolApiKeyRecord): void {
    const now = Date.now();
    const limit = Math.max(1, Number(apiKey.rate_limit_per_min) || 60);
    const current = this.rateWindows.get(apiKey.id);
    const window =
      !current || now - current.startedAt >= 60_000
        ? { count: 0, startedAt: now }
        : current;
    if (window.count >= limit) {
      throw new HttpException(
        { error: 'ai_tool_rate_limit_exceeded', retry_after_seconds: 60 },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    window.count += 1;
    this.rateWindows.set(apiKey.id, window);
  }
}
