import { BdsTxController } from './bds-tx.controller';

describe('BdsTxController', () => {
  it('convertDeposit delegates to service', async () => {
    const convertDeposit = jest.fn().mockResolvedValue({ id: 'tx1', stage: 'deposit' });
    const controller = new BdsTxController({ convertDeposit } as never);
    await controller.convertDeposit(
      'h1',
      { deposit_vnd: 200, policy_id: 'pol', row_version: 3 },
      't1',
      'idem-1',
    );
    expect(convertDeposit).toHaveBeenCalledWith(
      'h1',
      {
        deposit_vnd: 200,
        policy_id: 'pol',
        row_version: 3,
        list_price_vnd: undefined,
        discount_pct: undefined,
        discount_approved: undefined,
        net_price_vnd: undefined,
      },
      { tenantId: 't1', idempotencyKey: 'idem-1' },
    );
  });

  it('cancel delegates to service', async () => {
    const cancel = jest.fn().mockResolvedValue({ id: 'tx1', stage: 'cancelled' });
    const controller = new BdsTxController({ cancel } as never);
    await controller.cancel('tx1', { reason: 'khach bo' }, 't1');
    expect(cancel).toHaveBeenCalledWith('tx1', 'khach bo', 't1');
  });
});
