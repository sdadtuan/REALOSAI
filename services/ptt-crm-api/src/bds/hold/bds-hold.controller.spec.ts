import { BdsHoldController } from './bds-hold.controller';

describe('BdsHoldController', () => {
  it('create delegates unit id, body, tenant, and idempotency key', async () => {
    const holds = { create: jest.fn().mockResolvedValue({ id: 'h1', status: 'active' }) };
    const ctl = new BdsHoldController(holds as never);
    await expect(
      ctl.create(
        9,
        { lead_id: 44, row_version: 1, channel_partner_id: 'ag-1', note: 'n' },
        't1',
        'k1',
      ),
    ).resolves.toEqual({ id: 'h1', status: 'active' });
    expect(holds.create).toHaveBeenCalledWith(
      9,
      { lead_id: 44, row_version: 1, channel_partner_id: 'ag-1', note: 'n' },
      { tenantId: 't1', idempotencyKey: 'k1' },
    );
  });
});
