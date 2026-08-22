import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as webpush from 'web-push';
import { AppConfigService } from '../config/app-config.service';
import type { AlertSeverity } from './b2b-alert.util';
import { B2bStaffPushRepository } from './b2b-staff-push.repository';

export interface B2bStaffPushSendResult {
  sent: number;
  failed: number;
  skipped?: boolean;
}

@Injectable()
export class B2bStaffPushSender implements OnModuleInit {
  private readonly logger = new Logger(B2bStaffPushSender.name);
  private configured = false;

  constructor(
    private readonly repo: B2bStaffPushRepository,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit(): void {
    this.refreshVapidConfig();
  }

  private refreshVapidConfig(): boolean {
    const publicKey =
      (process.env.PTT_B2B_VAPID_PUBLIC ?? '').trim() || this.config.portalVapidPublicKey;
    const privateKey =
      (process.env.PTT_B2B_VAPID_PRIVATE ?? '').trim() || this.config.portalVapidPrivateKey;
    if (!publicKey || !privateKey) {
      this.configured = false;
      return false;
    }
    webpush.setVapidDetails(this.config.portalVapidSubject, publicKey, privateKey);
    this.configured = true;
    return true;
  }

  async send(input: {
    staffId: number;
    title: string;
    severity: AlertSeverity;
    leadId?: number;
  }): Promise<B2bStaffPushSendResult> {
    if (!this.config.b2bPush) {
      return { sent: 0, failed: 0, skipped: true };
    }

    const ready = await this.repo.tableReady();
    if (!ready) {
      return { sent: 0, failed: 0, skipped: true };
    }

    const subs = await this.repo.listForStaff(input.staffId);
    if (!subs.length) {
      return { sent: 0, failed: 0 };
    }

    const url = input.leadId != null ? `/crm/leads/${input.leadId}` : '/crm/b2b/leads';
    const payload = JSON.stringify({
      title: input.title,
      body: input.severity === 'urgent' ? 'Lead Hot — mở ngay' : 'Lead B2B mới',
      data: { url, leadId: input.leadId ?? null, severity: input.severity },
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subs) {
      if (sub.fcm_token && this.config.fcmServerKey) {
        const ok = await this.sendFcm(sub.fcm_token, input.title, url);
        if (ok) sent += 1;
        else failed += 1;
        continue;
      }
      if (!sub.endpoint || !sub.p256dh || !sub.auth) continue;
      if (!this.configured && !this.refreshVapidConfig()) {
        return { sent: 0, failed: 0, skipped: true };
      }
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 4 },
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status =
          err && typeof err === 'object' && typeof (err as { statusCode?: unknown }).statusCode === 'number'
            ? (err as { statusCode: number }).statusCode
            : null;
        if (status === 404 || status === 410) {
          await this.repo.deleteStaleWeb(input.staffId, sub.endpoint);
        }
        this.logger.warn('B2B staff web-push failed: %s', err instanceof Error ? err.message : String(err));
      }
    }

    return { sent, failed };
  }

  private async sendFcm(token: string, title: string, url: string): Promise<boolean> {
    const serverKey = this.config.fcmServerKey;
    if (!serverKey) return false;
    try {
      const res = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body: 'Lead B2B mới' },
          data: { url, title },
          priority: 'high',
        }),
      });
      const json = (await res.json()) as { success?: number };
      return res.ok && (json.success ?? 0) > 0;
    } catch {
      return false;
    }
  }
}
