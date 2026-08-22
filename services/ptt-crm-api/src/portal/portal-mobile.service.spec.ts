import { AppConfigService } from '../config/app-config.service';
import { PortalMobileService } from './portal-mobile.service';
import { PortalNativeDeviceRepository } from './portal-native-device.repository';
import { PortalNativePushSenderService } from './portal-native-push-sender.service';

describe('PortalMobileService', () => {
  const config = {
    mobileNativePushEnabled: true,
    mobileMinVersion: '0.2.0',
    mobileForceUpdate: true,
    portalPublicUrl: 'https://portal.test',
    portalPushTestInProd: false,
  } as AppConfigService;

  const devices = {
    tableReady: jest.fn().mockResolvedValue(true),
    upsert: jest.fn().mockResolvedValue({
      id: 'dev-1',
      client_id: '550e8400-e29b-41d4-a716-446655440000',
      portal_user_id: 'user-1',
      platform: 'ios',
      device_token: 'token-abc',
      app_version: '0.1.0',
      user_agent: 'test',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    deleteForUser: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<PortalNativeDeviceRepository>;

  const nativeSender = {
    isConfigured: jest.fn().mockReturnValue(true),
    sendToUsers: jest.fn().mockResolvedValue({
      ok: true,
      configured: true,
      sent: 1,
      failed: 0,
      removed_stale: 0,
      errors: [],
    }),
  } as unknown as jest.Mocked<PortalNativePushSenderService>;

  const user = {
    sub: 'user-1',
    client_id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'approver@test.local',
    role: 'approver' as const,
    iat: 1,
    exp: 9999999999,
  };

  function makeService() {
    return new PortalMobileService(config, devices, nativeSender);
  }

  it('getConfig flags force_update when client below min_version', () => {
    const svc = makeService();
    const out = svc.getConfig('0.1.0');
    expect(out.force_update).toBe(true);
    expect(out.native_push_enabled).toBe(true);
    expect(out.deep_link_scheme).toBe('pttads');
  });

  it('registerDevice upserts native token', async () => {
    const svc = makeService();
    const out = await svc.registerDevice(user, {
      token: 'token-abc',
      platform: 'ios',
      app_version: '0.1.0',
    });
    expect(out.ok).toBe(true);
    expect(out.platform).toBe('ios');
    expect(devices.upsert).toHaveBeenCalled();
  });

  it('testNativePush delegates to native sender', async () => {
    const svc = makeService();
    const out = await svc.testNativePush(user);
    expect(out.ok).toBe(true);
    expect(nativeSender.sendToUsers).toHaveBeenCalled();
  });
});
