import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { StaffAuthService } from './staff-auth.service';
import { StaffJwtPayload } from './staff-jwt.util';

@Injectable()
export class StaffJwtGuard implements CanActivate {
  constructor(private readonly auth: StaffAuthService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { staffUser?: StaffJwtPayload }>();
    const header = String(req.headers.authorization ?? '').trim();
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) {
      throw new UnauthorizedException({ error: 'Bearer token required' });
    }
    return this.auth.verifyAccessToken(token).then((payload) => {
      req.staffUser = payload;
      return true;
    });
  }
}

export const StaffUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): StaffJwtPayload | undefined => {
    const req = ctx.switchToHttp().getRequest<
      Request & { staffUser?: StaffJwtPayload; staffAuthVia?: 'internal' | 'jwt' }
    >();
    if (req.staffUser) return req.staffUser;
    if (req.staffAuthVia === 'internal') return undefined;
    throw new UnauthorizedException({ error: 'Unauthorized' });
  },
);
