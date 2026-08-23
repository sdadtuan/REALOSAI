import {
  buildCapiDispatchPayload,
  capiPurchaseValueVnd,
  shouldEmitCapiPurchase,
  shouldEnqueueCapiHttp,
} from './bds-capi.util';

describe('bds-capi.util', () => {
  it('Purchase emits on deposit by default, not contracted', () => {
    expect(shouldEmitCapiPurchase('deposit', 'deposit')).toBe(true);
    expect(shouldEmitCapiPurchase('contracted', 'deposit')).toBe(false);
    expect(shouldEmitCapiPurchase('contracted', 'contracted')).toBe(true);
    expect(shouldEmitCapiPurchase('deposit', 'contracted')).toBe(false);
  });

  it('Purchase value is net_price_vnd not list', () => {
    expect(capiPurchaseValueVnd({ net_price_vnd: 99, list_price_vnd: 200 })).toBe(99);
    expect(capiPurchaseValueVnd({ net_price_vnd: 0, list_price_vnd: 200 })).toBe(0);
  });

  it('no HTTP when CAPI off or client missing', () => {
    expect(shouldEnqueueCapiHttp({ capiOn: false, clientId: 'c1' })).toBe(false);
    expect(shouldEnqueueCapiHttp({ capiOn: true, clientId: '' })).toBe(false);
    expect(shouldEnqueueCapiHttp({ capiOn: true, clientId: 'c1' })).toBe(true);
  });

  it('dispatch payload uses event dict worker already understands', () => {
    const payload = buildCapiDispatchPayload({
      clientId: '11111111-1111-1111-1111-111111111111',
      leadId: 7,
      eventName: 'Purchase',
      valueVnd: 99,
      eventId: 'bds:Purchase:tx1',
    });
    expect(payload).toEqual({
      client_id: '11111111-1111-1111-1111-111111111111',
      lead_id: 7,
      event: {
        event_name: 'Purchase',
        value: 99,
        currency: 'VND',
        event_id: 'bds:Purchase:tx1',
      },
    });
  });
});
