import { AppConfigService } from '../config/app-config.service';
import { PortalNotifyWebhookService } from '../portal/portal-notify-webhook.service';
import { AiInsightsRepository } from './ai-insights.repository';
import { CoachDigestDeliveryService } from './coach-digest-delivery.service';

describe('CoachDigestDeliveryService', () => {
  const config = {
    coachDigestEmailEnabled: true,
    coachDigestRecipients: ['gdkd@pttads.vn', 'sales@pttads.vn'],
  } as unknown as AppConfigService;
  const webhook = {
    send: jest.fn().mockResolvedValue({ ok: true }),
  } as unknown as jest.Mocked<PortalNotifyWebhookService>;
  const insights = {
    updateCoachDigestDelivery: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<AiInsightsRepository>;

  beforeEach(() => jest.clearAllMocks());

  it('sends the aggregate preview and stores sent metadata', async () => {
    const service = new CoachDigestDeliveryService(config, webhook, insights);

    const result = await service.deliver({
      digestId: 'digest-1',
      weekKey: '2026-W31',
      teamId: 'org',
      emailPreview: 'Aggregate only',
      metadata: {},
    });

    expect(result.status).toBe('sent');
    expect(webhook.send).toHaveBeenCalledWith(
      {
        source: 'coach_digest_weekly',
        to: ['gdkd@pttads.vn', 'sales@pttads.vn'],
        subject: 'PTT Coach Digest — 2026-W31',
        body: 'Aggregate only',
        week_key: '2026-W31',
        team_id: 'org',
        digest_id: 'digest-1',
      },
      { enabled: true },
    );
    expect(insights.updateCoachDigestDelivery).toHaveBeenCalledWith(
      'digest-1',
      expect.objectContaining({ email_status: 'sent', email_sent_at: expect.any(String) }),
    );
  });

  it('skips disabled delivery and persists skipped status', async () => {
    const service = new CoachDigestDeliveryService(
      { ...config, coachDigestEmailEnabled: false } as unknown as AppConfigService,
      webhook,
      insights,
    );

    const result = await service.deliver({
      digestId: 'digest-2',
      weekKey: '2026-W31',
      teamId: 'org',
      emailPreview: 'Aggregate only',
      metadata: {},
    });

    expect(result.status).toBe('skipped');
    expect(webhook.send).not.toHaveBeenCalled();
    expect(insights.updateCoachDigestDelivery).toHaveBeenCalledWith('digest-2', {
      email_status: 'skipped',
    });
  });

  it('does not resend a sent week unless forced', async () => {
    const service = new CoachDigestDeliveryService(config, webhook, insights);
    const input = {
      digestId: 'digest-3',
      weekKey: '2026-W31',
      teamId: 'org',
      emailPreview: 'Aggregate only',
      metadata: { email_status: 'sent' },
    };

    expect((await service.deliver(input)).status).toBe('skipped');
    expect(webhook.send).not.toHaveBeenCalled();

    expect((await service.deliver({ ...input, force: true })).status).toBe('sent');
    expect(webhook.send).toHaveBeenCalledTimes(1);
  });

  it('stores failed status when the webhook rejects delivery', async () => {
    webhook.send.mockResolvedValueOnce({ ok: false, error: 'webhook down' });
    const service = new CoachDigestDeliveryService(config, webhook, insights);

    const result = await service.deliver({
      digestId: 'digest-4',
      weekKey: '2026-W31',
      teamId: 'org',
      emailPreview: 'Aggregate only',
      metadata: {},
    });

    expect(result).toEqual({ status: 'failed', error: 'webhook down' });
    expect(insights.updateCoachDigestDelivery).toHaveBeenCalledWith('digest-4', {
      email_status: 'failed',
    });
  });
});
