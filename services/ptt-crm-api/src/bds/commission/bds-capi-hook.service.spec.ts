import { BdsCapiHookService } from './bds-capi-hook.service';

describe('BdsCapiHookService', () => {
  const prevCapi = process.env.PTT_BDS_CAPI;

  afterEach(() => {
    if (prevCapi === undefined) delete process.env.PTT_BDS_CAPI;
    else process.env.PTT_BDS_CAPI = prevCapi;
  });

  it('CAPI=0 does not insert', async () => {
    delete process.env.PTT_BDS_CAPI;
    const repo = { insertCapiEvent: jest.fn() };
    const svc = new BdsCapiHookService(repo as never);
    await svc.onPurchase({ id: 'tx1', lead_id: 7, net_price_vnd: 100, tenant_id: 't1' } as never);
    expect(repo.insertCapiEvent).not.toHaveBeenCalled();
  });

  it('CAPI=1 logs Purchase', async () => {
    process.env.PTT_BDS_CAPI = '1';
    const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
    const svc = new BdsCapiHookService(repo as never);
    await svc.onPurchase({ id: 'tx1', lead_id: 7, net_price_vnd: 100, tenant_id: 't1' } as never);
    expect(repo.insertCapiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'Purchase', transactionId: 'tx1' }),
    );
  });
});
