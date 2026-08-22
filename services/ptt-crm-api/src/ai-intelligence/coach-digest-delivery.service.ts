import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { PortalNotifyWebhookService } from '../portal/portal-notify-webhook.service';
import { AiInsightsRepository } from './ai-insights.repository';

export type CoachDigestEmailStatus = 'sent' | 'skipped' | 'failed';

export interface CoachDigestDeliveryInput {
  digestId: string;
  weekKey: string;
  teamId: string;
  emailPreview: string;
  metadata: Record<string, unknown>;
  force?: boolean;
}

@Injectable()
export class CoachDigestDeliveryService {
  private readonly logger = new Logger(CoachDigestDeliveryService.name);

  constructor(
    private readonly config: AppConfigService,
    private readonly webhook: PortalNotifyWebhookService,
    private readonly insights: AiInsightsRepository,
  ) {}

  async deliver(
    input: CoachDigestDeliveryInput,
  ): Promise<{ status: CoachDigestEmailStatus; error?: string }> {
    if (input.metadata.email_status === 'sent' && !input.force) {
      return { status: 'skipped' };
    }

    if (
      !this.config.coachDigestEmailEnabled ||
      this.config.coachDigestRecipients.length === 0 ||
      !input.emailPreview.trim()
    ) {
      await this.insights.updateCoachDigestDelivery(input.digestId, {
        email_status: 'skipped',
      });
      return { status: 'skipped' };
    }

    const result = await this.webhook.send(
      {
        source: 'coach_digest_weekly',
        to: this.config.coachDigestRecipients,
        subject: `PTT Coach Digest — ${input.weekKey}`,
        body: input.emailPreview,
        week_key: input.weekKey,
        team_id: input.teamId,
        digest_id: input.digestId,
      },
      { enabled: true },
    );

    if (!result.ok || result.skipped) {
      const status: CoachDigestEmailStatus = result.skipped ? 'skipped' : 'failed';
      await this.insights.updateCoachDigestDelivery(input.digestId, { email_status: status });
      if (!result.skipped) {
        this.logger.warn('coach digest delivery failed digest=%s: %s', input.digestId, result.error);
      }
      return result.error ? { status, error: result.error } : { status };
    }

    const sentAt = new Date().toISOString();
    await this.insights.updateCoachDigestDelivery(input.digestId, {
      email_status: 'sent',
      email_sent_at: sentAt,
    });
    return { status: 'sent' };
  }
}
