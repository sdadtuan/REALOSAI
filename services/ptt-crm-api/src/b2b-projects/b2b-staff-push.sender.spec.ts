import { B2bStaffPushSender } from './b2b-staff-push.sender';

describe('B2bStaffPushSender', () => {
  it('does not send when staff has no subscription', async () => {
    const repoEmpty = {
      tableReady: async () => true,
      listForStaff: async () => [],
    };
    const config = { b2bPush: true, portalVapidSubject: 'mailto:test@ptt.vn', fcmServerKey: null };
    const sender = new B2bStaffPushSender(repoEmpty as never, config as never);
    await expect(
      sender.send({ staffId: 9, title: 'Hot', severity: 'urgent', leadId: 1 }),
    ).resolves.toEqual({ sent: 0, failed: 0 });
  });

  it('no-ops when push flag is off', async () => {
    const repo = {
      tableReady: async () => true,
      listForStaff: async () => [{ endpoint: 'x', p256dh: 'y', auth: 'z' }],
    };
    const config = { b2bPush: false, portalVapidSubject: 'mailto:test@ptt.vn', fcmServerKey: null };
    const sender = new B2bStaffPushSender(repo as never, config as never);
    await expect(
      sender.send({ staffId: 9, title: 'Hot', severity: 'urgent', leadId: 1 }),
    ).resolves.toEqual({ sent: 0, failed: 0, skipped: true });
  });
});
