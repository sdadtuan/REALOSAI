import { BdsAftersalesController } from './bds-aftersales.controller';

describe('BdsAftersalesController', () => {
  it('handover delegates waive cap from jwt', async () => {
    const svc = { handover: jest.fn().mockResolvedValue({ id: 'tx1' }) };
    const staffAuth = { hasCapForPosition: jest.fn().mockResolvedValue(true) };
    const ctl = new BdsAftersalesController(svc as never, staffAuth as never);
    await ctl.handover(
      'tx1',
      { waive: true, waive_reason: 'KH nhận thô' },
      't1',
      { staffUser: { position_id: 1 } as never, staffAuthVia: 'jwt' } as never,
    );
    expect(svc.handover).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ waive: true, hasApproveCap: true }),
      't1',
    );
    expect(staffAuth.hasCapForPosition).toHaveBeenCalledWith(1, 'bds_aftersales', 'approve');
  });

  it('internal auth grants approve cap', async () => {
    const svc = { handover: jest.fn().mockResolvedValue({ id: 'tx1' }) };
    const staffAuth = { hasCapForPosition: jest.fn() };
    const ctl = new BdsAftersalesController(svc as never, staffAuth as never);
    await ctl.handover('tx1', { waive: true, waive_reason: 'KH nhận thô' }, 't1', {
      staffAuthVia: 'internal',
    } as never);
    expect(svc.handover).toHaveBeenCalledWith(
      'tx1',
      expect.objectContaining({ hasApproveCap: true }),
      't1',
    );
    expect(staffAuth.hasCapForPosition).not.toHaveBeenCalled();
  });
});
