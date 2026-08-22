import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalPushRepository } from './portal-push.repository';
import { PortalPushSenderService } from './portal-push-sender.service';

export interface PortalPushSubscribeBody {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  user_agent?: string;
}

@Injectable()
export class PortalPushService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: PortalPushRepository,
    private readonly sender: PortalPushSenderService,
  ) {}

  async getVapidPublicKey(): Promise<{ ok: boolean; enabled: boolean; public_key: string | null }> {
    const key = this.config.portalVapidPublicKey;
    return {
      ok: true,
      enabled: this.config.portalPushEnabled && Boolean(key),
      public_key: key,
    };
  }

  async subscribe(user: PortalJwtPayload, body: PortalPushSubscribeBody) {
    if (!this.config.portalPushEnabled) {
      throw new ForbiddenException('portal_push_disabled');
    }
    const endpoint = (body?.endpoint ?? '').trim();
    const p256dh = (body?.keys?.p256dh ?? '').trim();
    const auth = (body?.keys?.auth ?? '').trim();
    if (!endpoint || !p256dh || !auth) {
      throw new BadRequestException('invalid_subscription');
    }
    const ready = await this.repo.tableReady();
    if (!ready) {
      throw new BadRequestException('push_table_not_ready');
    }
    const row = await this.repo.upsert({
      clientId: user.client_id,
      portalUserId: user.sub,
      endpoint,
      p256dh,
      auth,
      userAgent: body.user_agent ?? null,
    });
    return {
      ok: true,
      table_ready: true,
      subscription_id: row?.id ?? null,
      endpoint,
    };
  }

  async unsubscribe(user: PortalJwtPayload, endpoint: string) {
    const normalized = (endpoint ?? '').trim();
    if (!normalized) {
      throw new BadRequestException('endpoint_required');
    }
    const ready = await this.repo.tableReady();
    if (!ready) {
      return { ok: true, table_ready: false, removed: false };
    }
    const removed = await this.repo.deleteForUser({
      clientId: user.client_id,
      portalUserId: user.sub,
      endpoint: normalized,
    });
    return { ok: true, table_ready: true, removed };
  }

  async testForUser(user: PortalJwtPayload) {
    if (process.env.NODE_ENV === 'production' && !this.config.portalPushTestInProd) {
      throw new ForbiddenException('push_test_disabled_in_prod');
    }
    const ready = await this.repo.tableReady();
    const subs = ready
      ? await this.repo.listForUser({ clientId: user.client_id, portalUserId: user.sub })
      : [];
    if (!subs.length) {
      return {
        ok: false,
        table_ready: ready,
        subscription_count: 0,
        send_status: 'no_subscription',
        message: 'Chưa bật push trên thiết bị — vào Settings → Bật thông báo đẩy.',
      };
    }

    const push = await this.sender.sendToUsers({
      clientId: user.client_id,
      portalUserIds: [user.sub],
      title: 'PTT Portal — test push',
      body: 'RNOS-M2 staging: web-push sender hoạt động.',
      url: '/notifications',
      data: { kind: 'push_test' },
    });

    return {
      ok: push.sent > 0,
      table_ready: ready,
      subscription_count: subs.length,
      send_status: push.sent > 0 ? 'sent' : 'failed',
      sent: push.sent,
      failed: push.failed,
      removed_stale: push.removed_stale,
      configured: push.configured,
      errors: push.errors,
      message:
        push.sent > 0
          ? 'Đã gửi test push — kiểm tra notification trên thiết bị.'
          : push.errors[0] ?? 'Gửi push thất bại — kiểm tra VAPID keys.',
    };
  }
}
