import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { AppConfigService } from '../config/app-config.service';
import { PortalNativePushSenderService } from './portal-native-push-sender.service';
import { PortalPushRepository } from './portal-push.repository';

export interface PortalPushSendInput {
  clientId: string;
  portalUserIds: string[];
  title: string;
  body: string;
  url?: string | null;
  data?: Record<string, unknown>;
}

export interface PortalPushSendResult {
  ok: boolean;
  configured: boolean;
  skipped?: boolean;
  sent: number;
  failed: number;
  removed_stale: number;
  errors: string[];
}

@Injectable()
export class PortalPushSenderService implements OnModuleInit {
  private readonly logger = new Logger(PortalPushSenderService.name);
  private configured = false;

  constructor(
    private readonly config: AppConfigService,
    private readonly repo: PortalPushRepository,
    private readonly nativeSender: PortalNativePushSenderService,
  ) {}

  onModuleInit(): void {
    this.refreshVapidConfig();
  }

  isConfigured(): boolean {
    return this.configured;
  }

  refreshVapidConfig(): boolean {
    const publicKey = this.config.portalVapidPublicKey;
    const privateKey = this.config.portalVapidPrivateKey;
    if (!this.config.portalPushEnabled || !publicKey || !privateKey) {
      this.configured = false;
      return false;
    }
    webpush.setVapidDetails(this.config.portalVapidSubject, publicKey, privateKey);
    this.configured = true;
    return true;
  }

  async sendToUsers(input: PortalPushSendInput): Promise<PortalPushSendResult> {
    const userIds = [...new Set(input.portalUserIds.filter(Boolean))];
    if (!userIds.length) {
      return {
        ok: true,
        configured: false,
        sent: 0,
        failed: 0,
        removed_stale: 0,
        errors: [],
      };
    }

    const web = await this.sendWebPush(input, userIds);
    const native = await this.nativeSender.sendToUsers({
      clientId: input.clientId,
      portalUserIds: userIds,
      title: input.title,
      body: input.body,
      url: input.url,
      data: input.data,
    });

    const sent = web.sent + native.sent;
    const failed = web.failed + native.failed;
    const removedStale = web.removed_stale + native.removed_stale;
    const errors = [...web.errors, ...native.errors].slice(0, 8);

    return {
      ok: (web.failed === 0 || web.sent > 0 || native.sent > 0) && native.ok,
      configured: web.configured || native.configured,
      skipped: web.skipped && native.skipped,
      sent,
      failed,
      removed_stale: removedStale,
      errors,
    };
  }

  private async sendWebPush(
    input: PortalPushSendInput,
    userIds: string[],
  ): Promise<PortalPushSendResult> {
    if (!this.config.portalPushEnabled) {
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
    if (!this.configured && !this.refreshVapidConfig()) {
      return {
        ok: false,
        configured: false,
        skipped: true,
        sent: 0,
        failed: 0,
        removed_stale: 0,
        errors: ['vapid_keys_not_configured'],
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
        errors: ['push_table_not_ready'],
      };
    }

    const subs = await this.repo.listForUsers({
      clientId: input.clientId,
      portalUserIds: userIds,
    });
    if (!subs.length) {
      return {
        ok: true,
        configured: true,
        sent: 0,
        failed: 0,
        removed_stale: 0,
        errors: [],
      };
    }

    const payload = JSON.stringify({
      title: input.title,
      body: input.body,
      data: {
        url: input.url ?? '/notifications',
        ...(input.data ?? {}),
      },
    });

    let sent = 0;
    let failed = 0;
    let removedStale = 0;
    const errors: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 4 },
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = this.extractStatus(err);
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${sub.endpoint.slice(0, 48)}…: ${message}`);
        if (status === 404 || status === 410) {
          const removed = await this.repo.deleteForUser({
            clientId: sub.client_id,
            portalUserId: sub.portal_user_id,
            endpoint: sub.endpoint,
          });
          if (removed) removedStale += 1;
        }
        this.logger.warn('web-push failed (%s): %s', status ?? 'unknown', message);
      }
    }

    return {
      ok: failed === 0 || sent > 0,
      configured: true,
      sent,
      failed,
      removed_stale: removedStale,
      errors,
    };
  }

  private extractStatus(err: unknown): number | null {
    if (!err || typeof err !== 'object') return null;
    const statusCode = (err as { statusCode?: unknown }).statusCode;
    return typeof statusCode === 'number' ? statusCode : null;
  }
}
