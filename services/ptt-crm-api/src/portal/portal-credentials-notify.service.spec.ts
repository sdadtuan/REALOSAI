import { PortalCredentialsNotifyService } from './portal-credentials-notify.service';
import { PortalNotifyWebhookService } from './portal-notify-webhook.service';

describe('PortalCredentialsNotifyService', () => {
  const webhook = { send: jest.fn() };
  const config = {
    portalPublicUrl: 'https://portal.pttads.vn',
    portalEmailNotifyEnabled: true,
  };

  const service = new PortalCredentialsNotifyService(config as never, webhook as unknown as PortalNotifyWebhookService);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('builds Vietnamese credentials template', () => {
    const out = service.buildTemplate({
      to: 'owner@spa.vn',
      clientName: 'Glow Beauty Spa',
      clientCode: 'GLOW-SPA',
      role: 'approver',
      password: 'PtTempPass!',
    });
    expect(out.subject).toContain('Glow Beauty Spa');
    expect(out.body).toContain('owner@spa.vn');
    expect(out.body).toContain('PtTempPass!');
    expect(out.body).toContain('https://portal.pttads.vn/login');
    expect(out.html).toContain('Approver');
  });

  it('skips send when email notify disabled', async () => {
    const disabled = new PortalCredentialsNotifyService(
      { ...config, portalEmailNotifyEnabled: false } as never,
      webhook as unknown as PortalNotifyWebhookService,
    );
    const out = await disabled.sendCredentialsEmail({
      to: 'owner@spa.vn',
      clientName: 'Glow Beauty Spa',
      role: 'viewer',
      password: 'PtTempPass!',
    });
    expect(out.skipped).toBe(true);
    expect(webhook.send).not.toHaveBeenCalled();
  });

  it('sends webhook payload when enabled', async () => {
    webhook.send.mockResolvedValue({ ok: true });
    const out = await service.sendCredentialsEmail({
      to: 'owner@spa.vn',
      clientName: 'Glow Beauty Spa',
      role: 'viewer',
      password: 'PtTempPass!',
    });
    expect(out.ok).toBe(true);
    expect(webhook.send).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'portal_credentials_welcome',
        to: 'owner@spa.vn',
      }),
    );
  });
});
