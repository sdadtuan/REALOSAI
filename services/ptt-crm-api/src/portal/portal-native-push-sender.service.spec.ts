import { AppConfigService } from '../config/app-config.service';
import { PortalNativeDeviceRepository } from './portal-native-device.repository';
import { PortalNativePushSenderService } from './portal-native-push-sender.service';

describe('PortalNativePushSenderService', () => {
  const config = {
    mobileNativePushEnabled: true,
    fcmServerKey: 'test-fcm-key',
  } as AppConfigService;

  const repo = {
    tableReady: jest.fn().mockResolvedValue(true),
    listForUsers: jest.fn().mockResolvedValue([
      {
        id: 'dev-1',
        client_id: '550e8400-e29b-41d4-a716-446655440000',
        portal_user_id: 'user-1',
        platform: 'android',
        device_token: 'fcm-token-1',
        app_version: null,
        user_agent: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]),
    deleteToken: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<PortalNativeDeviceRepository>;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('isConfigured when native push enabled and FCM key set', () => {
    const svc = new PortalNativePushSenderService(config, repo);
    expect(svc.isConfigured()).toBe(true);
  });

  it('sendToUsers skips when native push disabled', async () => {
    const disabled = { ...config, mobileNativePushEnabled: false } as AppConfigService;
    const svc = new PortalNativePushSenderService(disabled, repo);
    const out = await svc.sendToUsers({
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      portalUserIds: ['user-1'],
      title: 'Test',
      body: 'Body',
    });
    expect(out.skipped).toBe(true);
    expect(out.sent).toBe(0);
  });

  it('sendToUsers posts to FCM when devices exist', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: 1, failure: 0, results: [{}] }),
    } as Response);

    const svc = new PortalNativePushSenderService(config, repo);
    const out = await svc.sendToUsers({
      clientId: '550e8400-e29b-41d4-a716-446655440000',
      portalUserIds: ['user-1'],
      title: 'Creative pending',
      body: 'Approve now',
      url: '/creatives',
    });

    expect(out.sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://fcm.googleapis.com/fcm/send',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
