import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PortalNativeDeviceRepository } from './portal-native-device.repository';

export interface PortalNativePushSendInput {
  clientId: string;
  portalUserIds: string[];
  title: string;
  body: string;
  url?: string | null;
  data?: Record<string, unknown>;
}

export interface PortalNativePushSendResult {
  ok: boolean;
  configured: boolean;
  skipped?: boolean;
  sent: number;
  failed: number;
  removed_stale: number;
  errors: string[];
}

@Injectable()
export class PortalNativePushSenderService {
  private readonly logger = new Logger(PortalNativePushSenderService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly repo: PortalNativeDeviceRepository,
  ) {}

  isConfigured(): boolean {
    return this.config.mobileNativePushEnabled && Boolean(this.config.fcmServerKey);
  }

  async sendToUsers(input: PortalNativePushSendInput): Promise<PortalNativePushSendResult> {
    if (!this.config.mobileNativePushEnabled) {
      return {
        ok: true,
        configured: false,
        skipped: true,
        sent: 0,
        failed: 0,
        removed_stale: 0,
        errors: [],
      };
    }
    const serverKey = this.config.fcmServerKey;
    if (!serverKey) {
      return {
        ok: false,
        configured: false,
        skipped: true,
        sent: 0,
        failed: 0,
        removed_stale: 0,
        errors: ['fcm_server_key_not_configured'],
      };
    }

    const ready = await this.repo.tableReady();
    if (!ready) {
      return {
        ok: false,
        configured: true,
        skipped: true,
        sent: 0,
        failed: 0,
        removed_stale: 0,
        errors: ['native_device_table_not_ready'],
      };
    }

    const userIds = [...new Set(input.portalUserIds.filter(Boolean))];
    if (!userIds.length) {
      return { ok: true, configured: true, sent: 0, failed: 0, removed_stale: 0, errors: [] };
    }

    const devices = await this.repo.listForUsers({
      clientId: input.clientId,
      portalUserIds: userIds,
    });
    if (!devices.length) {
      return { ok: true, configured: true, sent: 0, failed: 0, removed_stale: 0, errors: [] };
    }

    let sent = 0;
    let failed = 0;
    let removedStale = 0;
    const errors: string[] = [];

    for (const device of devices) {
      try {
        const res = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            Authorization: `key=${serverKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: device.device_token,
            notification: {
              title: input.title,
              body: input.body,
            },
            data: {
              url: input.url ?? '/notifications',
              title: input.title,
              body: input.body,
              ...(input.data ?? {}),
            },
            priority: 'high',
          }),
        });
        const json = (await res.json()) as {
          success?: number;
          failure?: number;
          results?: Array<{ error?: string }>;
        };
        if (res.ok && (json.success ?? 0) > 0) {
          sent += 1;
          continue;
        }
        failed += 1;
        const errCode = json.results?.[0]?.error ?? `HTTP ${res.status}`;
        errors.push(`${device.platform}:${errCode}`);
        if (errCode === 'NotRegistered' || errCode === 'InvalidRegistration') {
          const removed = await this.repo.deleteToken(device.device_token);
          if (removed) removedStale += 1;
        }
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(message);
        this.logger.warn('FCM native push failed: %s', message);
      }
    }

    return {
      ok: failed === 0 || sent > 0,
      configured: true,
      sent,
      failed,
      removed_stale: removedStale,
      errors: errors.slice(0, 5),
    };
  }
}
