import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PortalJwtPayload } from './portal-jwt.util';
import { PortalNativeDeviceRepository } from './portal-native-device.repository';
import { PortalNativePushSenderService } from './portal-native-push-sender.service';

export interface RegisterNativeDeviceBody {
  token: string;
  platform?: string;
  app_version?: string;
  user_agent?: string;
}

@Injectable()
export class PortalMobileService {
  constructor(
    private readonly config: AppConfigService,
    private readonly devices: PortalNativeDeviceRepository,
    private readonly nativeSender: PortalNativePushSenderService,
  ) {}

  getConfig(clientVersion?: string | null) {
    const minVersion = this.config.mobileMinVersion;
    const client = (clientVersion ?? '').trim() || '0.0.0';
    const forceUpdate =
      this.config.mobileForceUpdate &&
      this.compareSemver(client, minVersion) < 0;
    return {
      ok: true,
      min_version: minVersion,
      force_update: forceUpdate,
      native_push_enabled: this.config.mobileNativePushEnabled,
      fcm_configured: this.nativeSender.isConfigured(),
      portal_url: this.config.portalPublicUrl,
      deep_link_scheme: 'pttads',
    };
  }

  async registerDevice(user: PortalJwtPayload, body: RegisterNativeDeviceBody) {
    if (!this.config.mobileNativePushEnabled) {
      throw new ForbiddenException('mobile_native_push_disabled');
    }
    const token = (body?.token ?? '').trim();
    if (!token) {
      throw new BadRequestException('device_token_required');
    }
    const platform = this.normalizePlatform(body.platform);
    const ready = await this.devices.tableReady();
    if (!ready) {
      throw new BadRequestException('native_device_table_not_ready');
    }
    const row = await this.devices.upsert({
      clientId: user.client_id,
      portalUserId: user.sub,
      platform,
      deviceToken: token,
      appVersion: body.app_version ?? null,
      userAgent: body.user_agent ?? null,
    });
    return {
      ok: true,
      device_id: row?.id ?? null,
      platform,
    };
  }

  async unregisterDevice(user: PortalJwtPayload, deviceToken: string) {
    const token = (deviceToken ?? '').trim();
    if (!token) {
      throw new BadRequestException('device_token_required');
    }
    const ready = await this.devices.tableReady();
    if (!ready) {
      return { ok: true, removed: false };
    }
    const removed = await this.devices.deleteForUser({
      clientId: user.client_id,
      portalUserId: user.sub,
      deviceToken: token,
    });
    return { ok: true, removed };
  }

  async testNativePush(user: PortalJwtPayload) {
    if (process.env.NODE_ENV === 'production' && !this.config.portalPushTestInProd) {
      throw new ForbiddenException('push_test_disabled_in_prod');
    }
    const push = await this.nativeSender.sendToUsers({
      clientId: user.client_id,
      portalUserIds: [user.sub],
      title: 'PTT Portal — test native push',
      body: 'RNOS-M3 Capacitor: FCM sender hoạt động.',
      url: '/notifications',
      data: { kind: 'native_push_test' },
    });
    return {
      ok: push.sent > 0,
      configured: push.configured,
      sent: push.sent,
      failed: push.failed,
      errors: push.errors,
      message:
        push.sent > 0
          ? 'Đã gửi test native push — kiểm tra notification trên app.'
          : push.errors[0] ?? 'Gửi native push thất bại — kiểm tra PTT_FCM_SERVER_KEY.',
    };
  }

  private normalizePlatform(raw?: string | null): string {
    const p = (raw ?? 'unknown').trim().toLowerCase();
    if (p === 'ios' || p === 'android') return p;
    return 'unknown';
  }

  private compareSemver(a: string, b: string): number {
    const pa = a.split('.').map((x) => Number(x) || 0);
    const pb = b.split('.').map((x) => Number(x) || 0);
    for (let i = 0; i < 3; i += 1) {
      const da = pa[i] ?? 0;
      const db = pb[i] ?? 0;
      if (da !== db) return da < db ? -1 : 1;
    }
    return 0;
  }
}
