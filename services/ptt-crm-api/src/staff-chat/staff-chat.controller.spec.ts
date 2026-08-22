import { StaffChatController } from './staff-chat.controller';

describe('StaffChatController', () => {
  it('open post delegates room + tenant + staff', async () => {
    const svc = { postMessage: jest.fn().mockResolvedValue({ id: 'm1' }) };
    const staffAuth = { hasCapForPosition: jest.fn() };
    const ctl = new StaffChatController(svc as never, staffAuth as never);
    await ctl.postMessage('r1', { body: 'hi' }, 't1', {
      staffUser: { sub: '7', position_id: 1 },
    } as never);
    expect(svc.postMessage).toHaveBeenCalledWith(
      'r1',
      7,
      expect.objectContaining({ body: 'hi' }),
      't1',
    );
  });
});
