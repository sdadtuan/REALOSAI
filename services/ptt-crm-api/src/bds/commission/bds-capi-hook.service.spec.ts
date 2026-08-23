import { BdsCapiHookService } from './bds-capi-hook.service';

describe('BdsCapiHookService', () => {
  const prevCapi = process.env.PTT_BDS_CAPI;
  const prevClient = process.env.PTT_BDS_CAPI_CLIENT_ID;

  afterEach(() => {
    if (prevCapi === undefined) delete process.env.PTT_BDS_CAPI;
    else process.env.PTT_BDS_CAPI = prevCapi;
    if (prevClient === undefined) delete process.env.PTT_BDS_CAPI_CLIENT_ID;
    else process.env.PTT_BDS_CAPI_CLIENT_ID = prevClient;
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

  it('CAPI=1 Purchase value is net_price_vnd', async () => {
    process.env.PTT_BDS_CAPI = '1';
    const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
    const jobs = { enqueueCapiDispatch: jest.fn() };
    const svc = new BdsCapiHookService(repo as never, jobs as never);
    await svc.onPurchase({
      id: 'tx1',
      lead_id: 7,
      net_price_vnd: 99,
      list_price_vnd: 200,
      tenant_id: 't1',
    } as never);
    expect(repo.insertCapiEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'Purchase', valueVnd: 99, transactionId: 'tx1' }),
    );
  });

  it('CAPI=1 without client inserts skipped and does not enqueue', async () => {
    process.env.PTT_BDS_CAPI = '1';
    delete process.env.PTT_BDS_CAPI_CLIENT_ID;
    const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
    const jobs = { enqueueCapiDispatch: jest.fn() };
    const svc = new BdsCapiHookService(repo as never, jobs as never);
    await svc.onPurchase({ id: 'tx1', lead_id: 7, net_price_vnd: 99, tenant_id: 't1' } as never);
    expect(repo.insertCapiEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'skipped' }));
    expect(jobs.enqueueCapiDispatch).not.toHaveBeenCalled();
  });

  it('CAPI=1 with client enqueues existing capi_dispatch job', async () => {
    process.env.PTT_BDS_CAPI = '1';
    process.env.PTT_BDS_CAPI_CLIENT_ID = '11111111-1111-1111-1111-111111111111';
    const repo = { insertCapiEvent: jest.fn().mockResolvedValue(undefined) };
    const jobs = { enqueueCapiDispatch: jest.fn().mockResolvedValue({ id: 'j1' }) };
    const svc = new BdsCapiHookService(repo as never, jobs as never);
    await svc.onPurchase({ id: 'tx1', lead_id: 7, net_price_vnd: 99, tenant_id: 't1' } as never);
    expect(jobs.enqueueCapiDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'bds:capi:Purchase:tx1',
        clientId: '11111111-1111-1111-1111-111111111111',
      }),
    );
  });
});
