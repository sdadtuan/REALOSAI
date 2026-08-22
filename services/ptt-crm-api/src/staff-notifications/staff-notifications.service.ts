import { ForbiddenException, Injectable } from '@nestjs/common';
import { StaffJwtPayload } from '../staff-auth/staff-jwt.util';
import { StaffNotificationsRepository } from './staff-notifications.repository';

@Injectable()
export class StaffNotificationsService {
  constructor(private readonly repo: StaffNotificationsRepository) {}

  private requireUser(payload: StaffJwtPayload | undefined): StaffJwtPayload {
    if (!payload?.sub) {
      throw new ForbiddenException({ error: 'staff_required' });
    }
    return payload;
  }

  async list(payload: StaffJwtPayload | undefined, unreadOnly: boolean, limitRaw?: string) {
    const user = this.requireUser(payload);
    const limit = Math.min(Math.max(Number(limitRaw ?? 30) || 30, 1), 100);
    const { rows, unread } = await this.repo.list({
      userId: user.sub,
      unreadOnly,
      limit,
    });
    return { ok: true, notifications: rows, unread };
  }

  async markRead(payload: StaffJwtPayload | undefined, id: string) {
    const user = this.requireUser(payload);
    const notification = await this.repo.markRead(user.sub, id);
    return { ok: true, notification };
  }
}
